import "dotenv/config";
import {
  Agent,
  validHex,
  IdentifierKind,
  type Signer,
} from "@xmtp/agent-sdk";
import type { WalletSendCalls } from "@xmtp/node-sdk";
import { encodeFunctionData, parseUnits, hexToNumber, createPublicClient, http, type Hex } from "viem";
import { base } from "viem/chains";
import {
  createWallet as owsCreateWallet,
  getWallet as owsGetWallet,
  signMessage as owsSignMessage,
  signAndSend as owsSignAndSend,
  listWallets as owsListWallets,
} from "@open-wallet-standard/core";
import * as readline from "node:readline";

const AGENT_ADDRESS = process.env.AGENT_ADDRESS || "0x379cf10f35950dDc581940EDD4dCBD16Dd226518";
const CLIENT_WALLET = process.env.OWS_CLIENT_WALLET || "client-researcher";
const BASE_RPC = "https://mainnet.base.org";

// ERC-20 transfer ABI
const erc20TransferAbi = [
  {
    type: "function" as const,
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable" as const,
  },
] as const;

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

// Execute USDC transfer via OWS signAndSend
async function executePayment(walletName: string, calls: WalletSendCalls): Promise<string> {
  const call = calls.calls[0];
  if (!call) throw new Error("No calls in payment request");

  const to = call.to as Hex;
  const data = call.data as Hex | undefined;

  // Build raw transaction hex for OWS
  // For ERC-20 transfer, the data field is already encoded by the agent
  const client = createPublicClient({ chain: base, transport: http(BASE_RPC) });

  const wallet = owsGetWallet(walletName);
  if (!wallet) throw new Error(`OWS wallet "${walletName}" not found`);
  const evmAccount = wallet.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
  if (!evmAccount) throw new Error("No EVM account");
  const from = evmAccount.address as Hex;

  // Get nonce and gas estimates
  const nonce = await client.getTransactionCount({ address: from });
  const gasPrice = await client.getGasPrice();

  // Encode transaction as RLP hex for OWS
  // OWS signAndSend handles serialization internally — we pass the raw components
  const txHex = JSON.stringify({
    to,
    data: data || "0x",
    value: call.value || "0x0",
    chainId: 8453, // Base mainnet
    nonce,
    gasPrice: gasPrice.toString(),
    gasLimit: 100000,
  });

  console.log(`\n🔐 Signing transaction via OWS wallet "${walletName}"...`);
  console.log(`   To: ${to}`);
  console.log(`   From: ${from}`);

  try {
    const result = owsSignAndSend(walletName, "evm", txHex, undefined, undefined, BASE_RPC);
    console.log(`✅ Transaction sent: ${result.txHash}`);
    return result.txHash;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OWS signAndSend failed: ${msg}`);
  }
}

// Store pending payment requests
let pendingPayment: WalletSendCalls | null = null;

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

  // Create DM with the research agent
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
    pendingPayment = calls;

    const chainId = hexToNumber(validHex(calls.chainId));
    console.log(`\n💳 Payment request received!`);
    console.log(`   Chain: Base (${chainId})`);
    console.log(`   Calls: ${calls.calls.length}`);
    if (calls.calls[0]?.metadata?.description) {
      console.log(`   ${calls.calls[0].metadata.description}`);
    }
    console.log(`\n   Type "pay" to sign & send via OWS wallet, or "skip" to cancel.\n`);
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
  console.log(`   /research 0x<address>  — request wallet research ($0.05 USDC)`);
  console.log(`   pay                    — approve pending payment via OWS`);
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

    if (input === "pay") {
      if (!pendingPayment) {
        console.log("❌ No pending payment request.");
        rl.prompt();
        return;
      }

      try {
        const txHash = await executePayment(CLIENT_WALLET, pendingPayment);
        // Send transaction reference back to agent
        await dm.sendTransactionReference({
          namespace: "eip155",
          networkId: pendingPayment.chainId,
          reference: txHash,
        });
        console.log(`📤 Transaction reference sent to agent.`);
        pendingPayment = null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`❌ Payment failed: ${msg}`);
        console.log(`\n💡 Make sure you have USDC on Base in wallet ${myAddress}`);
      }
      rl.prompt();
      return;
    }

    if (input === "skip") {
      pendingPayment = null;
      console.log("⏭️  Payment skipped.");
      rl.prompt();
      return;
    }

    // Send as regular message
    await dm.sendText(input);
    console.log(`📤 Sent: ${input}`);
    rl.prompt();
  });
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
