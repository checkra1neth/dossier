#!/usr/bin/env node

import WebSocket from "ws";
import { execSync } from "node:child_process";
import {
  getWallet as owsGetWallet,
  signTypedData as owsSignTypedData,
  listWallets as owsListWallets,
  createWallet as owsCreateWallet,
} from "@open-wallet-standard/core";

const DEFAULT_HOST = "wss://dossier-production-1366.up.railway.app";
const VERSION = "1.0.0";

// ── Parse args ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let sessionCode = "";
  let walletName = process.env.OWS_WALLET || "client-researcher";
  let host = process.env.DOSSIER_HOST || DEFAULT_HOST;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--wallet" || a === "-w") {
      walletName = args[++i];
    } else if (a === "--host") {
      host = args[++i];
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a === "--version" || a === "-v") {
      console.log(`dossier-connect v${VERSION}`);
      process.exit(0);
    } else if (!a.startsWith("-")) {
      sessionCode = a;
    }
  }

  if (!sessionCode) {
    printHelp();
    process.exit(1);
  }

  return { sessionCode, walletName, host };
}

function printHelp() {
  console.log(`
  dossier-connect — Connect your OWS wallet to the Dossier dashboard

  Usage:
    npx dossier-connect <session-code> [options]

  Options:
    -w, --wallet <name>   OWS wallet name (default: client-researcher)
    --host <url>          Server URL (default: production)
    -h, --help            Show help
    -v, --version         Show version

  Examples:
    npx dossier-connect abc123
    npx dossier-connect abc123 --wallet my-wallet

  Prerequisites:
    Install OWS CLI: https://ows.dev
    Create a wallet: ows wallet create <name>
`);
}

// ── Wallet helpers ──────────────────────────────────────────────────

function ensureWallet(walletName) {
  const wallets = owsListWallets();
  if (!wallets.find((w) => w.name === walletName)) {
    console.log(`Creating OWS wallet "${walletName}"...`);
    owsCreateWallet(walletName);
  }

  const wallet = owsGetWallet(walletName);
  if (!wallet) {
    console.error(`\x1b[31mError:\x1b[0m OWS wallet "${walletName}" not found.`);
    console.error(`Create one with: ows wallet create ${walletName}`);
    process.exit(1);
  }

  const evm = wallet.accounts.find((a) => a.chainId.startsWith("eip155:"));
  if (!evm) {
    console.error(`\x1b[31mError:\x1b[0m No EVM account in wallet "${walletName}".`);
    process.exit(1);
  }

  return evm.address;
}

function signTypedData(walletName, params) {
  const { EIP712Domain: _, ...cleanTypes } = params.types;
  const json = JSON.stringify(
    {
      domain: params.domain,
      types: cleanTypes,
      primaryType: params.primaryType,
      message: params.message,
    },
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
  );
  const result = owsSignTypedData(walletName, "evm", json);
  const sig = result.signature.startsWith("0x")
    ? result.signature
    : `0x${result.signature}`;
  if (sig.length === 130) {
    const v = (result.recoveryId ?? 0) + 27;
    return `${sig}${v.toString(16).padStart(2, "0")}`;
  }
  return sig;
}

// ── WebSocket bridge ────────────────────────────────────────────────

function connect(sessionCode, walletName, host) {
  const address = ensureWallet(walletName);
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const wsUrl = `${host}/ws?session=${sessionCode}&role=signer`;

  console.log(`\x1b[36m⚡ Dossier Connect v${VERSION}\x1b[0m`);
  console.log(`   Wallet: ${walletName} (${short})`);
  console.log(`   Connecting to ${host.replace("wss://", "").replace("ws://", "")}...`);

  const ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "hello", address, name: walletName }));
    console.log(`\x1b[32m✅ Paired!\x1b[0m`);
    console.log(`   Waiting for signing requests... (Ctrl+C to disconnect)\n`);
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "sign_request" && msg.id && msg.params) {
      const method = msg.method || "unknown";
      const label =
        msg.params.description || msg.params.price
          ? `x402 payment $${msg.params.price} USDC for /${msg.params.command}`
          : method;

      process.stdout.write(`\x1b[33m🔐 ${label}\x1b[0m\n`);

      try {
        if (method === "x402Payment") {
          const p = msg.params;
          const bodyJson = JSON.stringify(p.body);
          const result = execSync(
            `ows pay request "${p.serverUrl}/${p.command}" --wallet "${walletName}" --method POST --body '${bodyJson}' --no-passphrase 2>&1`,
            { encoding: "utf-8", timeout: 30_000 },
          );
          const paid = result.includes("Paid");
          if (paid) {
            ws.send(
              JSON.stringify({
                type: "sign_response",
                id: msg.id,
                signature: "paid",
              }),
            );
            console.log(`   \x1b[32m✅ Paid\x1b[0m\n`);
          } else {
            ws.send(
              JSON.stringify({
                type: "sign_rejected",
                id: msg.id,
                reason: result.trim().split("\n")[0],
              }),
            );
            console.log(
              `   \x1b[31m❌ Failed: ${result.trim().split("\n")[0]}\x1b[0m\n`,
            );
          }
        } else {
          const signature = signTypedData(walletName, msg.params);
          ws.send(
            JSON.stringify({ type: "sign_response", id: msg.id, signature }),
          );
          console.log(`   \x1b[32m✅ Signed\x1b[0m\n`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Signing failed";
        ws.send(
          JSON.stringify({ type: "sign_rejected", id: msg.id, reason }),
        );
        console.log(`   \x1b[31m❌ ${reason}\x1b[0m\n`);
      }
    }
  });

  ws.on("close", () => {
    console.log("\x1b[2mDisconnected.\x1b[0m");
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error(`\x1b[31mConnection error:\x1b[0m ${err.message}`);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    console.log("\n\x1b[2mDisconnecting...\x1b[0m");
    ws.close();
  });
}

// ── Main ────────────────────────────────────────────────────────────

const { sessionCode, walletName, host } = parseArgs();
connect(sessionCode, walletName, host);
