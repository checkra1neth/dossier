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
import { execSync } from "node:child_process";
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
function executeX402Payment(walletName: string, targetAddress: string): string {
  const body = JSON.stringify({ address: targetAddress });
  const cmd = `ows pay request "${SERVER_URL}/research" --wallet "${walletName}" --method POST --body '${body}' --no-passphrase`;

  console.log(`\n🔐 Executing x402 payment via OWS...`);
  console.log(`   ows pay request → ${SERVER_URL}/research`);
  console.log(`   Wallet: ${walletName}`);
  console.log(`   EIP-3009 TransferWithAuthorization (gasless)\n`);

  const result = execSync(cmd, { encoding: "utf-8", timeout: 0 });
  return result;
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

  // Listen for incoming messages
  agent.on("text", async (ctx) => {
    const sender = await ctx.getSenderAddress();
    if (sender?.toLowerCase() === myAddress.toLowerCase()) return;
    console.log(`\n📩 Agent:\n${"-".repeat(50)}`);
    console.log(ctx.message.content);
    console.log(`${"-".repeat(50)}\n`);
    rl.prompt();
  });

  agent.on("wallet-send-calls", async (ctx) => {
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

  console.log(`🎯 OWS Deep Research Client. Commands:`);
  console.log(`   /research 0x<address>  — request research ($0.05 USDC)`);
  console.log(`   pay                    — approve payment (x402 + OWS, gasless)`);
  console.log(`   quit                   — exit\n`);

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
        // Use ows pay request for x402 (EIP-3009 gasless payment)
        const result = executeX402Payment(CLIENT_WALLET, pendingAddress);
        console.log(`\n📊 Research result (via x402):\n${"-".repeat(50)}`);
        console.log(result);
        console.log(`${"-".repeat(50)}\n`);

        // Also notify the XMTP agent
        await dm.sendText(`✅ Paid via x402. Research for ${pendingAddress} completed via REST API.`);
        pendingAddress = null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`❌ Payment failed: ${msg}`);
        console.log(`💡 Make sure you have USDC on Base in wallet ${myAddress}`);
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
