import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { Agent } from "@xmtp/agent-sdk";
import crypto from "node:crypto";
import { registerRelayInboxId } from "./xmtp.ts";

// XMTP agent reference — set from index.ts after agent starts
let xmtpAgent: Agent | null = null;

export function setChatAgent(agent: Agent): void {
  xmtpAgent = agent;
}

// Relay XMTP client — separate identity for sending messages on behalf of dashboard users
let relayClient: Awaited<ReturnType<typeof import("@xmtp/node-sdk").Client.create>> | null = null;
let relayAddress: string | null = null;

async function getRelayClient(): Promise<typeof relayClient> {
  if (relayClient) return relayClient;

  try {
    const nodeSdk = await import("@xmtp/node-sdk");
    const Client = nodeSdk.Client;
    const ows = await import("@open-wallet-standard/core");

    const relayWalletName = "chat-relay";

    // Restore relay wallet from env key or create new
    const wallets = ows.listWallets();
    if (!wallets.find((w: { name: string }) => w.name === relayWalletName)) {
      const relayKey = process.env.RELAY_WALLET_PRIVATE_KEY;
      if (relayKey) {
        ows.importWalletPrivateKey(relayWalletName, relayKey);
        console.log(`[chat-relay] Imported OWS wallet "${relayWalletName}" from env key`);
      } else {
        ows.createWallet(relayWalletName);
        const exported = ows.exportWallet(relayWalletName);
        console.log(`[chat-relay] Created NEW OWS wallet "${relayWalletName}". Set RELAY_WALLET_PRIVATE_KEY=${exported} to persist!`);
      }
    }

    const wallet = ows.getWallet(relayWalletName);
    const evmAccount = wallet.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
    if (!evmAccount) throw new Error("No EVM account in relay wallet");
    relayAddress = evmAccount.address as string;

    const signer = {
      type: "EOA" as const,
      getIdentifier: () => ({
        identifier: relayAddress!.toLowerCase(),
        identifierKind: nodeSdk.IdentifierKind.Ethereum,
      }),
      signMessage: (message: string) => {
        const result = ows.signMessage(relayWalletName, "evm", message);
        const sigHex = result.signature.startsWith("0x") ? result.signature.slice(2) : result.signature;
        const bytes = new Uint8Array(Buffer.from(sigHex, "hex"));
        if (bytes.length === 64) {
          const full = new Uint8Array(65);
          full.set(bytes);
          full[64] = (result.recoveryId ?? 0) + 27;
          return full;
        }
        return bytes;
      },
    };

    const dbKeyHex = process.env.DB_ENCRYPTION_KEY;
    const dbEncryptionKey = dbKeyHex
      ? new Uint8Array(Buffer.from(dbKeyHex.startsWith("0x") ? dbKeyHex.slice(2) : dbKeyHex, "hex"))
      : undefined;

    const xmtpEnv = (process.env.XMTP_ENV || "dev") as "dev" | "production";

    relayClient = await Client.create(signer, { env: xmtpEnv, dbEncryptionKey } as Parameters<typeof Client.create>[1]);
    console.log(`[chat-relay] XMTP relay client ready: ${relayAddress}`);
    // Register relay's inboxId so agent skips payment for relay-forwarded messages
    registerRelayInboxId(relayClient.inboxId);
    return relayClient;
  } catch (err) {
    console.error("[chat-relay] Failed to create relay client:", (err as Error).message);
    return null;
  }
}

interface PendingRequest {
  resolve: (signature: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Session {
  browser: WebSocket | null;
  signer: WebSocket | null;
  address: string | null;
  name: string | null;
  pending: Map<string, PendingRequest>;
  createdAt: number;
}

const sessions = new Map<string, Session>();

const SESSION_TTL = 5 * 60 * 1000; // 5 min for unpaired sessions
const SIGN_TIMEOUT = 60_000; // 60s to sign

function getOrCreateSession(sessionId: string): Session {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { browser: null, signer: null, address: null, name: null, pending: new Map(), createdAt: Date.now() };
    sessions.set(sessionId, s);
  }
  return s;
}

function send(ws: WebSocket | null, msg: object): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function cleanupSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  for (const [, req] of s.pending) {
    clearTimeout(req.timer);
    req.reject(new Error("Session closed"));
  }
  s.pending.clear();
  sessions.delete(sessionId);
}

// Periodic cleanup of stale unpaired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (!s.signer && !s.browser && now - s.createdAt > SESSION_TTL) {
      cleanupSession(id);
    }
  }
}, 30_000);

// ---------------------------------------------------------------------------
// Chat relay — messages go through XMTP agent with x402 payment
// ---------------------------------------------------------------------------

const CHAT_PRICE_MAP: Record<string, string> = {
  quick: "0.01", research: "0.05", pnl: "0.02", defi: "0.02",
  history: "0.02", nft: "0.02", compare: "0.05",
  swap: "0.01", bridge: "0.01", send: "0.01", watch: "0.10",
};

const PUBLIC_URL = process.env.PUBLIC_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
  || `http://localhost:${process.env.PORT || "4000"}`;

export function setupBridge(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const chatWss = new WebSocketServer({ noServer: true });

  // Chat WebSocket — relay messages through XMTP agent
  chatWss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const bridgeSessionId = url.searchParams.get("session");

    if (!xmtpAgent) {
      send(ws, { type: "error", error: "XMTP agent not available" });
      ws.close();
      return;
    }

    const agentAddr = xmtpAgent.address;
    if (!agentAddr) {
      send(ws, { type: "error", error: "XMTP agent address not available" });
      ws.close();
      return;
    }

    console.log(`[chat] Setting up XMTP relay...`);

    try {
      // Get relay client (separate XMTP identity, not the agent)
      const relay = await getRelayClient();
      if (!relay) {
        send(ws, { type: "error", error: "Chat relay not available" });
        ws.close();
        return;
      }

      // Create DM from relay → agent
      const nodeSdk = await import("@xmtp/node-sdk");
      const dm = await relay.conversations.createDmWithIdentifier(
        { identifier: agentAddr.toLowerCase(), identifierKind: nodeSdk.IdentifierKind.Ethereum },
      );
      console.log(`[chat] XMTP DM relay→agent created: ${dm.id}`);

      // Sync agent so it discovers this new DM before any messages are sent
      if (xmtpAgent) {
        await xmtpAgent.client.conversations.syncAll();
        console.log(`[chat] Agent conversations synced — ready to receive messages`);
      }

      // Load recent message history
      await dm.sync();
      const history = await dm.messages({ limit: 20 });
      const historyMsgs = history
        .filter((m) => typeof m.content === "string" && (m.content as string).trim())
        .map((m) => ({
          id: m.id,
          sender: m.senderInboxId === relay.inboxId ? "user" : "agent",
          text: m.content as string,
          time: new Date(Number(m.sentAtNs) / 1_000_000).toISOString(),
        }));
      send(ws, { type: "history", messages: historyMsgs });

      // Stream new messages
      const stream = await dm.stream();
      const streamReader = (async () => {
        for await (const msg of stream) {
          if (typeof msg.content !== "string" || !(msg.content as string).trim()) continue;
          // Only forward AGENT responses (not relay's own messages)
          if (msg.senderInboxId === relay.inboxId) continue;

          send(ws, {
            type: "message",
            id: msg.id,
            sender: "agent",
            text: msg.content as string,
          });
        }
      })();

      ws.on("close", () => {
        console.log("[chat] Client disconnected, ending XMTP stream");
        stream.return().catch(() => {});
      });

      // Handle incoming messages from browser — x402 payment + XMTP relay
      ws.on("message", async (raw) => {
        let msg: { type: string; text?: string };
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (msg.type === "message" && msg.text) {
          const text = msg.text.trim();
          const cmdMatch = text.match(/^\/(\w+)/);
          const cmd = cmdMatch?.[1]?.toLowerCase();
          const price = cmd ? CHAT_PRICE_MAP[cmd as keyof typeof CHAT_PRICE_MAP] : undefined;

          console.log(`[chat] XMTP relay: ${text.slice(0, 50)}`);

          // Paid command → do x402 payment via bridge before forwarding to XMTP
          if (price) {
            if (!bridgeSessionId || !getSession(bridgeSessionId)) {
              send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
                text: `❌ OWS wallet not connected. Pair your wallet to make paid requests.` });
              return;
            }

            send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
              text: `💳 /${cmd} · $${price} USDC · Paying...` });

            try {
              const addresses = text.match(/0x[a-fA-F0-9]{40}/g);
              const body = cmd === "compare"
                ? { addressA: addresses?.[0], addressB: addresses?.[1] }
                : { address: addresses?.[0] };

              await requestSignature(bridgeSessionId, "x402Payment", {
                description: `x402 payment $${price} USDC for /${cmd}`,
                command: cmd,
                price,
                body,
                serverUrl: PUBLIC_URL,
              });

              console.log(`[chat] x402 /${cmd} $${price} — ✅ paid`);
              send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
                text: `✅ Paid $${price} USDC! Processing request...` });
            } catch (err) {
              console.log(`[chat] x402 /${cmd} $${price} — ❌ ${(err as Error).message}`);
              send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
                text: `❌ Payment failed: ${(err as Error).message}` });
              return;
            }
          }

          // For /balance without address, inject the bridge wallet address
          let forwardText = msg.text!;
          if (cmd === "balance" && !text.match(/0x[a-fA-F0-9]{40}/)) {
            const session = bridgeSessionId ? getSession(bridgeSessionId) : null;
            if (session?.address) {
              forwardText = `/balance ${session.address}`;
            }
          }

          // Forward to XMTP agent (free commands go straight, paid commands after payment)
          try {
            await dm.sync();
            await dm.sendText(forwardText);
          } catch (err) {
            send(ws, { type: "error", error: (err as Error).message });
          }
        }
      });

      void streamReader;

    } catch (err) {
      console.error("[chat] XMTP relay setup failed:", (err as Error).message);
      send(ws, { type: "error", error: `XMTP setup failed: ${(err as Error).message}` });
      ws.close();
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/ws/chat") {
      chatWss.handleUpgrade(req, socket, head, (ws) => { chatWss.emit("connection", ws, req); });
      return;
    }

    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const sessionId = url.searchParams.get("session");
    const role = url.searchParams.get("role");

    if (!sessionId || !role || !["browser", "signer"].includes(role)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const session = getOrCreateSession(sessionId);

      if (role === "browser") {
        if (session.browser) session.browser.close();
        session.browser = ws;
        console.log(`[bridge] Browser connected: session=${sessionId}`);

        // If signer already connected, notify browser
        if (session.signer && session.address) {
          send(ws, { type: "paired", address: session.address, name: session.name });
        }

        // Relay sign requests from browser to signer
        ws.on("message", (raw) => {
          let msg: { type: string; id?: string };
          try { msg = JSON.parse(raw.toString()); } catch { return; }

          console.log(`[bridge] Browser message: type=${msg.type}, signer=${!!session.signer}`);
          if (msg.type === "sign_request" && msg.id && session.signer) {
            console.log(`[bridge] Relaying sign_request ${msg.id} to signer`);
            // Forward to signer, track pending so response goes back to browser
            const pending = session.pending;
            pending.set(msg.id, {
              resolve: (signature: string) => { send(session.browser, { type: "sign_response", id: msg.id, signature }); },
              reject: (err: Error) => { send(session.browser, { type: "sign_rejected", id: msg.id, reason: err.message }); },
              timer: setTimeout(() => {
                pending.delete(msg.id!);
                send(session.browser, { type: "sign_rejected", id: msg.id, reason: "Signing timeout" });
              }, 60_000),
            });
            send(session.signer, JSON.parse(raw.toString()));
          }
        });

        ws.on("close", () => {
          if (session.browser === ws) session.browser = null;
          if (!session.signer && !session.browser) cleanupSession(sessionId);
        });
      }

      if (role === "signer") {
        if (session.signer) session.signer.close();
        session.signer = ws;
        console.log(`[bridge] Signer connected: session=${sessionId}`);

        ws.on("message", (raw) => {
          let msg: { type: string; address?: string; name?: string; id?: string; signature?: string; reason?: string };
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }

          if (msg.type === "hello" && msg.address) {
            session.address = msg.address;
            session.name = msg.name ?? "unknown";
            console.log(`[bridge] Signer identified: ${session.name} (${session.address})`);
            send(session.browser, { type: "paired", address: session.address, name: session.name });
          }

          if (msg.type === "sign_response" && msg.id && msg.signature) {
            const req = session.pending.get(msg.id);
            if (req) {
              clearTimeout(req.timer);
              session.pending.delete(msg.id);
              req.resolve(msg.signature);
            }
          }

          if (msg.type === "sign_rejected" && msg.id) {
            const req = session.pending.get(msg.id);
            if (req) {
              clearTimeout(req.timer);
              session.pending.delete(msg.id);
              req.reject(new Error(msg.reason ?? "Signing rejected"));
            }
          }
        });

        ws.on("close", () => {
          if (session.signer === ws) {
            session.signer = null;
            session.address = null;
            session.name = null;
            send(session.browser, { type: "disconnected" });
            // Reject all pending requests
            for (const [id, req] of session.pending) {
              clearTimeout(req.timer);
              req.reject(new Error("Signer disconnected"));
              session.pending.delete(id);
            }
          }
          if (!session.signer && !session.browser) cleanupSession(sessionId);
        });
      }
    });
  });

  console.log("[bridge] WebSocket bridge ready on /ws");
}

export function getSession(sessionId: string): { address: string; name: string; connected: boolean } | null {
  const s = sessions.get(sessionId);
  if (!s || !s.signer || !s.address) return null;
  return { address: s.address, name: s.name ?? "unknown", connected: true };
}

export function requestSignature(
  sessionId: string,
  method: string,
  params: object,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = sessions.get(sessionId);
    if (!s || !s.signer || s.signer.readyState !== WebSocket.OPEN) {
      reject(new Error("No signer connected"));
      return;
    }

    const id = `req_${crypto.randomBytes(4).toString("hex")}`;
    const timer = setTimeout(() => {
      s.pending.delete(id);
      reject(new Error("Signing timeout (60s)"));
    }, SIGN_TIMEOUT);

    s.pending.set(id, { resolve, reject, timer });
    send(s.signer, { type: "sign_request", id, method, params });
  });
}
