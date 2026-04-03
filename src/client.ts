import "dotenv/config";
import {
  Agent,
  createERC20TransferCalls,
  getERC20Decimals,
  validHex,
  IdentifierKind,
  type Signer,
} from "@xmtp/agent-sdk";
import { parseUnits, hexToNumber } from "viem";
import { base } from "viem/chains";
import {
  createWallet as owsCreateWallet,
  getWallet as owsGetWallet,
  signMessage as owsSignMessage,
  listWallets as owsListWallets,
} from "@open-wallet-standard/core";
import * as readline from "node:readline";

const AGENT_ADDRESS = process.env.AGENT_ADDRESS || "0x379cf10f35950dDc581940EDD4dCBD16Dd226518";
const CLIENT_WALLET = process.env.OWS_CLIENT_WALLET || "client-researcher";

function createOwsSigner(walletName: string): Signer {
  const wallet = owsGetWallet(walletName);
  if (!wallet) throw new Error(`OWS wallet "${walletName}" not found`);

  const evmAccount = wallet.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
  if (!evmAccount) throw new Error(`No EVM account in OWS wallet "${walletName}"`);

  const address = evmAccount.address as `0x${string}`;

  return {
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
}

async function main() {
  // Create OWS wallet if needed
  const wallets = owsListWallets();
  if (!wallets.find((w: { name: string }) => w.name === CLIENT_WALLET)) {
    console.log(`Creating OWS wallet "${CLIENT_WALLET}"...`);
    owsCreateWallet(CLIENT_WALLET);
  }

  const signer = createOwsSigner(CLIENT_WALLET);
  const id = signer.getIdentifier();
  const myAddress = typeof id === "object" && "identifier" in id ? id.identifier : "unknown";
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

  // Create DM with the research agent
  console.log(`\n📨 Opening DM with research agent: ${AGENT_ADDRESS}`);
  const dm = await agent.createDmWithAddress(AGENT_ADDRESS as `0x${string}`);
  console.log(`✅ DM created\n`);

  // Listen for incoming messages
  agent.on("text", async (ctx) => {
    const sender = await ctx.getSenderAddress();
    if (sender?.toLowerCase() === myAddress.toLowerCase()) return; // skip own messages
    console.log(`\n📩 Agent response:\n${"-".repeat(50)}`);
    console.log(ctx.message.content);
    console.log(`${"-".repeat(50)}\n`);
    rl.prompt();
  });

  agent.on("wallet-send-calls", async (ctx) => {
    const sender = await ctx.getSenderAddress();
    if (sender?.toLowerCase() === myAddress.toLowerCase()) return;
    const calls = ctx.message.content;
    console.log(`\n💳 Payment request received!`);
    console.log(`   Chain: ${calls.chainId}`);
    console.log(`   Calls: ${calls.calls.length}`);
    if (calls.calls[0]?.metadata?.description) {
      console.log(`   Description: ${calls.calls[0].metadata.description}`);
    }
    console.log(`\n   Type "pay" to approve or anything else to skip.\n`);
    rl.prompt();
  });

  await agent.start();

  // Interactive CLI
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "you> ",
  });

  console.log(`🎯 Connected to research agent. Commands:`);
  console.log(`   /research 0x<address>  — request wallet research`);
  console.log(`   /help                  — show help`);
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

    await dm.sendText(input);
    console.log(`📤 Sent: ${input}`);
    rl.prompt();
  });
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
