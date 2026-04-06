import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { Agent } from "@xmtp/agent-sdk";
import crypto from "node:crypto";
import { registerRelayInboxId } from "./xmtp.ts";
import { handleQuick, quickToText } from "./commands/quick.ts";
import { handlePnl, pnlToText } from "./commands/pnl.ts";
import { handleDefi, defiToText } from "./commands/defi.ts";
import { handleHistory, historyToText } from "./commands/history.ts";
import { handleNft, nftToText } from "./commands/nft.ts";
import { handleCompare, compareToText } from "./commands/compare.ts";
import { handleBalance, balanceToText } from "./commands/balance.ts";
import { research } from "./pipeline.ts";
import { reportToMarkdown } from "./report.ts";

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
    const relayKey = process.env.RELAY_WALLET_PRIVATE_KEY;
    const wallets = ows.listWallets();
    const existingRelay = wallets.find((w: { name: string }) => w.name === relayWalletName);
    if (relayKey) {
      if (existingRelay) try { ows.deleteWallet(relayWalletName); } catch {}
      ows.importWalletPrivateKey(relayWalletName, relayKey);
      console.log(`[chat-relay] Imported OWS wallet "${relayWalletName}" from env key`);
    } else if (!existingRelay) {
      ows.createWallet(relayWalletName);
      const exported = ows.exportWallet(relayWalletName);
      console.log(`[chat-relay] Created NEW wallet. Set RELAY_WALLET_PRIVATE_KEY=${exported} to persist!`);
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
// Chat — direct command execution (no XMTP relay, no race conditions)
// ---------------------------------------------------------------------------

const CHAT_PRICE_MAP: Record<string, string> = {
  quick: "0.01", research: "0.05", pnl: "0.02", defi: "0.02",
  history: "0.02", nft: "0.02", compare: "0.05",
  swap: "0.01", bridge: "0.01", send: "0.01", watch: "0.10",
};

const PUBLIC_URL = process.env.PUBLIC_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
  || `http://localhost:${process.env.PORT || "4000"}`;

// Execute a chat command directly (bypass XMTP relay)
async function executeCommand(cmd: string, text: string, walletAddress?: string): Promise<string> {
  const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];

  switch (cmd) {
    case "help":
      return (
        `Dossier — Wallet Intelligence\n\n` +
        `Analytics:\n` +
        `  /quick 0x<addr>  — portfolio snapshot ($0.01)\n` +
        `  /research 0x<addr> — deep research ($0.05)\n` +
        `  /pnl 0x<addr>  — profit & loss ($0.02)\n` +
        `  /defi 0x<addr>  — DeFi positions ($0.02)\n` +
        `  /history 0x<addr> — tx history ($0.02)\n` +
        `  /nft 0x<addr>  — NFT portfolio ($0.02)\n` +
        `  /compare 0x<a> 0x<b> — compare wallets ($0.05)\n\n` +
        `Wallet:\n` +
        `  /balance — check wallet balance (free)\n\n` +
        `Payments via USDC on Base.`
      );
    case "quick":
      if (!address) return "Usage: /quick 0x<address>";
      return quickToText(await handleQuick(address));
    case "pnl":
      if (!address) return "Usage: /pnl 0x<address>";
      return pnlToText(await handlePnl(address));
    case "defi":
      if (!address) return "Usage: /defi 0x<address>";
      return defiToText(await handleDefi(address));
    case "history":
      if (!address) return "Usage: /history 0x<address>";
      return historyToText(await handleHistory(address));
    case "nft":
      if (!address) return "Usage: /nft 0x<address>";
      return nftToText(await handleNft(address));
    case "compare": {
      const addresses = text.match(/0x[a-fA-F0-9]{40}/g);
      if (!addresses || addresses.length < 2) return "Usage: /compare 0x<addressA> 0x<addressB>";
      return compareToText(await handleCompare(addresses[0], addresses[1]));
    }
    case "balance": {
      const target = address || walletAddress;
      if (!target) return "Usage: /balance 0x<address>";
      return balanceToText(await handleBalance(target));
    }
    case "research":
      if (!address) return "Usage: /research 0x<address>";
      return reportToMarkdown(await research(address));
    default:
      return `Unknown command: /${cmd}. Send /help for available commands.`;
  }
}

export function setupBridge(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const chatWss = new WebSocketServer({ noServer: true });

  // Chat WebSocket — direct command execution
  chatWss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const bridgeSessionId = url.searchParams.get("session");

    console.log(`[chat] Client connected`);
    send(ws, { type: "history", messages: [] });

    ws.on("close", () => {
      console.log("[chat] Client disconnected");
    });

    ws.on("message", async (raw) => {
      let msg: { type: string; text?: string };
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "message" && msg.text) {
        const text = msg.text.trim();
        const cmdMatch = text.match(/^\/(\w+)/);
        const cmd = cmdMatch?.[1]?.toLowerCase();
        const price = cmd ? CHAT_PRICE_MAP[cmd as keyof typeof CHAT_PRICE_MAP] : undefined;

        console.log(`[chat] Command: ${text.slice(0, 50)}`);

        // Paid command → x402 payment via bridge wallet
        if (price) {
          if (!bridgeSessionId || !getSession(bridgeSessionId)) {
            send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
              text: `OWS wallet not connected. Pair your wallet to make paid requests.` });
            return;
          }

          send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
            text: `/${cmd} · $${price} USDC · Paying...` });

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

            console.log(`[chat] x402 /${cmd} $${price} — paid`);
            send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
              text: `Paid $${price} USDC! Processing...` });
          } catch (err) {
            console.log(`[chat] x402 /${cmd} $${price} — ${(err as Error).message}`);
            send(ws, { type: "message", id: `sys_${Date.now()}`, sender: "agent",
              text: `Payment failed: ${(err as Error).message}` });
            return;
          }
        }

        // Execute command directly
        const cmdName = cmd || "help";
        const walletAddress = bridgeSessionId ? getSession(bridgeSessionId)?.address : undefined;
        try {
          const result = await executeCommand(cmdName, text, walletAddress);
          send(ws, { type: "message", id: `res_${Date.now()}`, sender: "agent", text: result });
          console.log(`[chat] /${cmdName} — done`);
        } catch (err) {
          console.error(`[chat] /${cmdName} failed:`, err);
          send(ws, { type: "message", id: `err_${Date.now()}`, sender: "agent",
            text: `Error: ${err instanceof Error ? err.message : err}` });
        }
      }
    });
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
