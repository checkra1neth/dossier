import "dotenv/config";
import { execSync } from "node:child_process";
import WebSocket from "ws";
import {
  getWallet as owsGetWallet,
  signMessage as owsSignMessage,
  signTypedData as owsSignTypedData,
} from "@open-wallet-standard/core";

const DEFAULT_HOST = "wss://dossier.up.railway.app";

function parseArgs(): { sessionCode: string; walletName: string; host: string } {
  const args = process.argv.slice(2);
  let sessionCode = "";
  let walletName = process.env.OWS_CLIENT_WALLET || "client-researcher";
  let host = process.env.BRIDGE_HOST || DEFAULT_HOST;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--wallet" && args[i + 1]) {
      walletName = args[++i];
    } else if (args[i] === "--host" && args[i + 1]) {
      host = args[++i];
    } else if (!args[i].startsWith("--")) {
      sessionCode = args[i];
    }
  }

  if (!sessionCode) {
    console.error("Usage: npm run bridge <session-code> [--wallet <name>] [--host <url>]");
    process.exit(1);
  }

  return { sessionCode, walletName, host };
}

function getWalletAddress(walletName: string): string {
  const wallet = owsGetWallet(walletName);
  if (!wallet) {
    console.error(`OWS wallet "${walletName}" not found.`);
    process.exit(1);
  }
  const evm = wallet.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
  if (!evm) {
    console.error(`No EVM account in wallet "${walletName}".`);
    process.exit(1);
  }
  return evm.address as string;
}

function signTypedData(walletName: string, params: {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}): string {
  const { EIP712Domain: _, ...cleanTypes } = params.types;
  const json = JSON.stringify(
    { domain: params.domain, types: cleanTypes, primaryType: params.primaryType, message: params.message },
    (_key, value) => typeof value === "bigint" ? value.toString() : value,
  );
  const result = owsSignTypedData(walletName, "evm", json);
  const sig = result.signature.startsWith("0x") ? result.signature : `0x${result.signature}`;
  if (sig.length === 130) {
    const v = (result.recoveryId ?? 0) + 27;
    return `${sig}${v.toString(16).padStart(2, "0")}`;
  }
  return sig;
}

function connect(sessionCode: string, walletName: string, host: string): void {
  const address = getWalletAddress(walletName);
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const wsUrl = `${host}/ws?session=${sessionCode}&role=signer`;
  console.log(`Connecting to ${host}...`);

  const ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "hello", address, name: walletName }));
    console.log(`Paired! Wallet: ${walletName} (${short})`);
    console.log("Waiting for signing requests...\n");
  });

  ws.on("message", (raw) => {
    let msg: { type: string; id?: string; method?: string; params?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "sign_request" && msg.id && msg.params) {
      const method = msg.method || "unknown";
      const label = (msg.params as { description?: string }).description || method;
      process.stdout.write(`Sign request: ${label}\n`);

      try {
        if (method === "x402Payment") {
          // Full x402 payment via OWS CLI
          const p = msg.params as { command: string; price: string; body: Record<string, unknown>; serverUrl: string };
          const bodyJson = JSON.stringify(p.body);
          const result = execSync(
            `ows pay request "${p.serverUrl}/${p.command}" --wallet "${walletName}" --method POST --body '${bodyJson}' --no-passphrase 2>&1`,
            { encoding: "utf-8", timeout: 30_000 },
          );
          const paid = result.includes("Paid");
          if (paid) {
            ws.send(JSON.stringify({ type: "sign_response", id: msg.id, signature: "paid" }));
            console.log("  Paid\n");
          } else {
            ws.send(JSON.stringify({ type: "sign_rejected", id: msg.id, reason: result.trim().split("\n")[0] }));
            console.log(`  Payment failed: ${result.trim().split("\n")[0]}\n`);
          }
        } else if (method === "signMessage") {
          // Raw message signing (used for XMTP identity)
          const message = (msg.params as { message: string }).message;
          const result = owsSignMessage(walletName, "evm", message);
          const sigHex = result.signature.startsWith("0x") ? result.signature.slice(2) : result.signature;
          // Ensure 65 bytes (r + s + v)
          let fullSig: string;
          if (sigHex.length === 128) {
            const v = (result.recoveryId ?? 0) + 27;
            fullSig = sigHex + v.toString(16).padStart(2, "0");
          } else {
            fullSig = sigHex;
          }
          ws.send(JSON.stringify({ type: "sign_response", id: msg.id, signature: fullSig }));
          console.log("  Signed\n");
        } else {
          // EIP-712 signTypedData
          const signature = signTypedData(walletName, msg.params as {
            domain: Record<string, unknown>;
            types: Record<string, unknown>;
            primaryType: string;
            message: Record<string, unknown>;
          });
          ws.send(JSON.stringify({ type: "sign_response", id: msg.id, signature }));
          console.log("  Signed\n");
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Signing failed";
        ws.send(JSON.stringify({ type: "sign_rejected", id: msg.id, reason }));
        console.log(`  Rejected: ${reason}\n`);
      }
    }
  });

  ws.on("close", () => {
    console.log("Disconnected.");
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error(`Connection error: ${err.message}`);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    console.log("\nDisconnecting...");
    ws.close();
  });
}

const { sessionCode, walletName, host } = parseArgs();
connect(sessionCode, walletName, host);
