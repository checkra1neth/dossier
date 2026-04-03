import "dotenv/config";
import {
  Agent,
  validHex,
  IdentifierKind,
  type Signer,
} from "@xmtp/agent-sdk";
import type { WalletSendCalls } from "@xmtp/node-sdk";
import { hexToNumber } from "viem";
import {
  createWallet as owsCreateWallet,
  getWallet as owsGetWallet,
  signMessage as owsSignMessage,
  listWallets as owsListWallets,
} from "@open-wallet-standard/core";
import { spawn } from "node:child_process";
import * as readline from "node:readline";

const AGENT_ADDRESS = process.env.AGENT_ADDRESS || "0x379cf10f35950dDc581940EDD4dCBD16Dd226518";
const CLIENT_WALLET = process.env.OWS_CLIENT_WALLET || "client-researcher";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";

function createOwsSigner(walletName: string): { signer: Signer; address: string } {
  const wallet = owsGetWallet(walletName);
  if (!wallet) throw new Error(`OWS wallet "${walletName}" not found`);

  const evmAccount = wallet.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
  if (!evmAccount) throw new Error(`No EVM account in OWS wallet "${walletName}"`);

  const address = evmAccount.address as `0x${string}`;

  const signer: Signer = {
    type: "EOA" as const,
    getIdentifier: () => ({
      identifier: address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: (message: string) => {
      const result = owsSignMessage(walletName, "evm", message);
      const sigHex = result.signature.startsWith("0x") ? result.signature.slice(2) : result.signature;
      const sigBytes = new Uint8Array(Buffer.from(sigHex, "hex"));
      if (sigBytes.length === 64) {
        const full = new Uint8Array(65);
        full.set(sigBytes);
        full[64] = (result.recoveryId ?? 0) + 27;
        return full;
      }
      return sigBytes;
    },
  };

  return { signer, address };
}

// Execute x402 payment via OWS CLI (EIP-3009, gasless)
function executeX402Payment(walletName: string, targetAddress: string): Promise<string> {
  const body = JSON.stringify({ address: targetAddress });

  console.log(`\n🔐 Executing x402 payment via OWS...`);
  console.log(`   ows pay request → ${SERVER_URL}/research`);
  console.log(`   Wallet: ${walletName}`);
  console.log(`   EIP-3009 TransferWithAuthorization (gasless)`);
  console.log(`\n⏳ Signing payment & waiting for research report...`);

  return new Promise((resolve, reject) => {
    const child = spawn("ows", [
      "pay", "request", `${SERVER_URL}/research`,
      "--wallet", walletName,
      "--method", "POST",
      "--body", body,
      "--no-passphrase",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let output = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.on("close", () => {
      // Split only the ows CLI header lines (before the JSON body)
      const lines = output.trim().split("\n");
      const httpStatusLine = lines.find(l => /^HTTP\s+\d{3}/.test(l));
      const httpStatus = httpStatusLine ? parseInt(httpStatusLine.replace("HTTP ", "")) : 0;

      // Find the JSON response (research report)
      const jsonLine = lines.find(l => l.startsWith("{") && l.length > 10);

      // Only check for balance errors in ows CLI output BEFORE the JSON body
      const headerText = lines.slice(0, lines.indexOf(jsonLine ?? "") || lines.length).join("\n");
      if (headerText.includes("insufficient") || headerText.includes("Insufficient")) {
        reject(new Error("Insufficient USDC balance on Base. Top up your wallet."));
        return;
      }

      if (httpStatus === 402) {
        if (headerText.includes("reverted") || headerText.includes("revert")) {
          reject(new Error(
            `Payment verification failed on-chain (contract reverted).\n` +
            `   This usually means insufficient USDC balance on Base.\n` +
            `   Wallet: ${walletName}\n` +
            `   Required: $0.05 USDC on Base (chain 8453)\n` +
            `   Top up your wallet and try again.`
          ));
        } else {
          reject(new Error(
            `Server returned 402 after payment.\n` +
            `   Check your USDC balance and try again.`
          ));
        }
        return;
      }

      // Show payment confirmation
      const paidLine = lines.find(l => l.includes("Paid"));
      if (paidLine) {
        console.log(`✅ ${paidLine.trim()}`);
      }

      if (jsonLine) {
        console.log(`✅ Research report received!`);
        resolve(jsonLine);
        return;
      }

      if (httpStatus >= 200 && httpStatus < 300) {
        resolve(output);
        return;
      }

      reject(new Error(`Unexpected response: HTTP ${httpStatus || "unknown"}\n${output}`));
    });
  });
}

// Store pending state
let pendingAddress: string | null = null;

async function main() {
  // Create OWS wallet if needed
  const wallets = owsListWallets();
  if (!wallets.find((w: { name: string }) => w.name === CLIENT_WALLET)) {
    console.log(`Creating OWS wallet "${CLIENT_WALLET}"...`);
    owsCreateWallet(CLIENT_WALLET);
  }

  const { signer, address: myAddress } = createOwsSigner(CLIENT_WALLET);
  console.log(`\n🔑 OWS Wallet: ${CLIENT_WALLET}`);
  console.log(`📍 Address: ${myAddress}`);

  const dbKeyHex = process.env.DB_ENCRYPTION_KEY;
  const dbEncryptionKey = dbKeyHex
    ? new Uint8Array(Buffer.from(dbKeyHex.startsWith("0x") ? dbKeyHex.slice(2) : dbKeyHex, "hex"))
    : undefined;

  const xmtpEnv = (process.env.XMTP_ENV || "dev") as "dev" | "production";

  console.log(`\n⏳ Connecting to XMTP (${xmtpEnv})...`);
  const agent = await Agent.create(signer, { env: xmtpEnv, dbEncryptionKey });
  console.log(`✅ XMTP connected: ${agent.address}`);

  console.log(`\n📨 Opening DM with research agent: ${AGENT_ADDRESS}`);
  const dm = await agent.createDmWithAddress(AGENT_ADDRESS as `0x${string}`);
  console.log(`✅ DM created\n`);

  // Ignore messages from before client started
  const startedAt = Date.now();

  // Listen for incoming messages
  agent.on("text", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const sender = await ctx.getSenderAddress();
    if (sender?.toLowerCase() === myAddress.toLowerCase()) return;
    console.log(`\n📩 Agent:\n${"-".repeat(50)}`);
    console.log(ctx.message.content);
    console.log(`${"-".repeat(50)}\n`);
    rl.prompt();
  });

  agent.on("wallet-send-calls", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const sender = await ctx.getSenderAddress();
    if (sender?.toLowerCase() === myAddress.toLowerCase()) return;
    const calls = ctx.message.content;

    const chainId = hexToNumber(validHex(calls.chainId));
    console.log(`\n💳 Payment request received!`);
    console.log(`   Chain: Base (${chainId})`);
    if (calls.calls[0]?.metadata?.description) {
      console.log(`   ${calls.calls[0].metadata.description}`);
    }
    console.log(`\n   Type "pay" to approve (x402 gasless via OWS), or "skip" to cancel.\n`);
    rl.prompt();
  });

  await agent.start();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "you> ",
  });

  console.log(`🎯 Dossier. Commands:\n`);
  console.log(` 📊 Analytics:`);
  console.log(`   /quick 0x<addr>          — portfolio snapshot ($0.01)`);
  console.log(`   /research 0x<addr>       — deep research ($0.05)`);
  console.log(`   /pnl 0x<addr>            — profit & loss ($0.02)`);
  console.log(`   /defi 0x<addr>           — DeFi positions ($0.02)`);
  console.log(`   /history 0x<addr>        — tx history ($0.02)`);
  console.log(`   /nft 0x<addr>            — NFT portfolio ($0.02)`);
  console.log(`   /compare 0x<a> 0x<b>     — compare wallets ($0.05)`);
  console.log(` 💰 Wallet:`);
  console.log(`   /balance                 — your wallet balance (free)`);
  console.log(`   /send <amt> <tok> to <addr> — send tokens ($0.01)`);
  console.log(`   /swap <amt> <tok> to <tok>  — swap tokens ($0.01)`);
  console.log(`   /bridge <amt> <tok> from <chain> to <chain> ($0.01)`);
  console.log(` 👁️ Monitoring:`);
  console.log(`   /watch 0x<addr>          — watch wallet activity ($0.10)`);
  console.log(`   /unwatch 0x<addr>        — stop watching (free)`);
  console.log(` ⚙️ Other:`);
  console.log(`   pay                      — approve x402 payment`);
  console.log(`   confirm / cancel         — confirm/cancel pending action`);
  console.log(`   quit                     — exit\n`);

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input === "quit" || input === "exit") {
      console.log("👋 Bye!");
      await agent.stop();
      process.exit(0);
    }

    if (input === "pay") {
      if (!pendingAddress) {
        console.log("❌ No pending research. Send /research first.");
        rl.prompt();
        return;
      }

      try {
        const result = await executeX402Payment(CLIENT_WALLET, pendingAddress);

        if (!result) {
          rl.prompt();
          return;
        }

        // Try to parse and display nicely
        try {
          const report = JSON.parse(result);
          const d = report.data;
          const a = report.analysis;
          const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          console.log(`\n📊 RESEARCH REPORT: ${report.address.slice(0,6)}...${report.address.slice(-4)}`);
          console.log(`${"━".repeat(50)}`);
          console.log(`💰 Total Value: $${usd(d.totalValueUsd)}`);
          console.log(`🔗 Chains: ${d.chains.length}`);
          console.log(`🧠 Smart Money: ${d.isSmartMoney ? "YES" : "NO"}`);
          console.log(`⚠️  Risk: ${a.riskLevel.toUpperCase()}`);
          console.log(`\n🏦 TOP POSITIONS`);
          d.topPositions.slice(0, 5).forEach((p: { asset: string; valueUsd: number; percentage: number }) => {
            console.log(`   ${p.asset}: $${usd(p.valueUsd)} (${p.percentage}%)`);
          });
          console.log(`\n🏁 VERDICT: ${a.verdict}`);
          console.log(`${"━".repeat(50)}\n`);
        } catch {
          console.log(`\n📊 Raw result:\n${result}\n`);
        }

        pendingAddress = null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`\n❌ Payment failed:\n   ${msg.split("\n").join("\n   ")}`);
        console.log(`\n💡 Wallet: ${myAddress}`);
        console.log(`   Send at least $0.10 USDC to this address on Base (chain 8453)`);
        console.log(`   Then try "pay" again.\n`);
        // Don't clear pendingAddress — let user retry after funding
      }
      rl.prompt();
      return;
    }

    if (input === "skip") {
      pendingAddress = null;
      console.log("⏭️  Skipped.");
      rl.prompt();
      return;
    }

    // Extract address for pending state
    const addrMatch = input.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch && input.startsWith("/research")) {
      pendingAddress = addrMatch[0];
    }

    await dm.sendText(input);
    console.log(`📤 Sent: ${input}`);
    rl.prompt();
  });
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
