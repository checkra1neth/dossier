import {
  Agent,
  CommandRouter,
  createUser,
  createSigner,
  createERC20TransferCalls,
  getERC20Decimals,
  validHex,
} from "@xmtp/agent-sdk";
import { parseUnits, hexToNumber } from "viem";
import { base } from "viem/chains";
import { research } from "./pipeline.ts";
import { reportToMarkdown } from "./report.ts";

const CHAIN = base;
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const RESEARCH_PRICE = "0.05"; // USDC

// Pending research requests: conversationId → target address
const pendingResearch = new Map<string, string>();

export async function startXmtpAgent(): Promise<Agent> {
  const walletKey = process.env.WALLET_KEY as `0x${string}`;
  if (!walletKey) throw new Error("WALLET_KEY is not set");

  const dbKeyHex = process.env.DB_ENCRYPTION_KEY;
  const dbEncryptionKey = dbKeyHex
    ? new Uint8Array(Buffer.from(dbKeyHex.startsWith("0x") ? dbKeyHex.slice(2) : dbKeyHex, "hex"))
    : undefined;

  const xmtpEnv = (process.env.XMTP_ENV || "dev") as "dev" | "production";

  const user = createUser(walletKey);
  const signer = createSigner(user);
  const agent = await Agent.create(signer, {
    env: xmtpEnv,
    dbEncryptionKey,
  });

  const USDC_DECIMALS = await getERC20Decimals({
    chain: CHAIN,
    tokenAddress: USDC_CONTRACT,
  });

  const router = new CommandRouter({ helpCommand: "/help" });

  router.command("/research", "Research a wallet address ($0.05 USDC)", async (ctx) => {
    const text = ctx.message.content as string;
    console.log(`[xmtp] Received: "${text}"`);

    const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
    const address = addressMatch?.[0];

    if (!address) {
      await ctx.conversation.sendText("Usage: /research 0x<address>\n\nProvide a valid Ethereum address.");
      return;
    }

    // Store pending research for this conversation
    const convId = ctx.conversation.id;
    pendingResearch.set(convId, address);

    // Request payment via wallet_sendCalls
    const senderAddress = await ctx.getSenderAddress();
    const receiverAddress = agent.address;

    const walletSendCalls = createERC20TransferCalls({
      chain: CHAIN,
      tokenAddress: USDC_CONTRACT,
      from: validHex(senderAddress),
      to: validHex(receiverAddress),
      amount: parseUnits(RESEARCH_PRICE, USDC_DECIMALS),
      description: `Pay $${RESEARCH_PRICE} USDC for deep wallet research on ${address.slice(0, 10)}...`,
    });

    await ctx.conversation.sendText(
      `💳 Deep research for ${address.slice(0, 6)}...${address.slice(-4)}\n` +
      `Price: $${RESEARCH_PRICE} USDC on Base\n\n` +
      `Approve the payment below to start research.`
    );

    await ctx.conversation.sendWalletSendCalls(walletSendCalls);
    console.log(`[xmtp] Payment request sent for ${address} in conversation ${convId}`);
  });

  // Handle payment confirmation
  agent.on("transaction-reference", async (ctx) => {
    const { networkId, reference } = ctx.message.content;
    const chainId = hexToNumber(validHex(networkId));
    const convId = ctx.conversation.id;

    console.log(`[xmtp] Transaction confirmed: chain=${chainId} tx=${reference}`);

    const targetAddress = pendingResearch.get(convId);
    if (!targetAddress) {
      await ctx.conversation.sendText(`✅ Payment received! (tx: ${reference})\n\nNo pending research request. Send /research 0x<address> first.`);
      return;
    }

    pendingResearch.delete(convId);

    await ctx.conversation.sendText(
      `✅ Payment confirmed!\n` +
      `tx: ${reference}\n\n` +
      `🔍 Researching ${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}... This may take 10-20 seconds.`
    );

    try {
      const report = await research(targetAddress);
      const markdown = reportToMarkdown(report);
      await ctx.conversation.sendText(markdown);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.conversation.sendText(`❌ Research failed: ${msg}`);
    }
  });

  router.default(async (ctx) => {
    await ctx.conversation.sendText(
      `👋 OWS Deep Research Service\n\n` +
      `Send /research 0x<address> to analyze any wallet.\n\n` +
      `Cost: $${RESEARCH_PRICE} USDC on Base per query.\n` +
      `I'll request payment, then deliver a full portfolio analysis.`
    );
  });

  agent.use(router.middleware());

  await agent.start();
  console.log(`[xmtp] Agent online: ${agent.address}`);

  return agent;
}
