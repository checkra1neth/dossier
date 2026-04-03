import {
  Agent,
  CommandRouter,
  createERC20TransferCalls,
  getERC20Decimals,
  validHex,
  type Signer,
  IdentifierKind,
} from "@xmtp/agent-sdk";
import { parseUnits, hexToNumber } from "viem";
import { base } from "viem/chains";
import {
  createWallet as owsCreateWallet,
  getWallet as owsGetWallet,
  signMessage as owsSignMessage,
  listWallets as owsListWallets,
} from "@open-wallet-standard/core";
import { research } from "./pipeline.ts";
import { reportToMarkdown } from "./report.ts";
import { handleQuick, quickToText } from "./commands/quick.ts";
import { handlePnl, pnlToText } from "./commands/pnl.ts";
import { handleDefi, defiToText } from "./commands/defi.ts";
import { handleHistory, historyToText } from "./commands/history.ts";
import { handleNft, nftToText } from "./commands/nft.ts";
import { handleCompare, compareToText } from "./commands/compare.ts";

const CHAIN = base;
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const RESEARCH_PRICE = "0.05"; // USDC

// Pending research requests: conversationId → target address
const pendingResearch = new Map<string, string>();

// Create XMTP Signer from OWS wallet
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
      // OWS returns {signature: hex, recoveryId: number}
      // XMTP expects Uint8Array (65 bytes: r + s + v)
      const sigHex = result.signature.startsWith("0x") ? result.signature.slice(2) : result.signature;
      const sigBytes = new Uint8Array(Buffer.from(sigHex, "hex"));
      // Append recovery ID as v byte if not already 65 bytes
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

export async function startXmtpAgent(): Promise<Agent> {
  const owsWalletName = process.env.OWS_WALLET_NAME || "research-agent";

  // Create OWS wallet if it doesn't exist
  const wallets = owsListWallets();
  if (!wallets.find((w: { name: string }) => w.name === owsWalletName)) {
    console.log(`[xmtp] Creating OWS wallet "${owsWalletName}"...`);
    owsCreateWallet(owsWalletName);
  }

  const signer = createOwsSigner(owsWalletName);
  const identifier = signer.getIdentifier();
  console.log(`[xmtp] OWS wallet "${owsWalletName}" → ${typeof identifier === 'object' && 'identifier' in identifier ? identifier.identifier : 'unknown'}`);

  const dbKeyHex = process.env.DB_ENCRYPTION_KEY;
  const dbEncryptionKey = dbKeyHex
    ? new Uint8Array(Buffer.from(dbKeyHex.startsWith("0x") ? dbKeyHex.slice(2) : dbKeyHex, "hex"))
    : undefined;

  const xmtpEnv = (process.env.XMTP_ENV || "dev") as "dev" | "production";

  const agent = await Agent.create(signer, {
    env: xmtpEnv,
    dbEncryptionKey,
  });

  const USDC_DECIMALS = await getERC20Decimals({
    chain: CHAIN,
    tokenAddress: USDC_CONTRACT,
  });

  // Ignore messages sent before agent started
  const startedAt = Date.now();

  const router = new CommandRouter({ helpCommand: "/help" });

  router.command("/research", "Research a wallet address ($0.05 USDC)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
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

  router.command("/quick", "Quick portfolio snapshot ($0.01)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /quick 0x<address>"); return; }
    try {
      const report = await handleQuick(address);
      await ctx.conversation.sendText(quickToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/pnl", "Profit & loss report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /pnl 0x<address>"); return; }
    try {
      const report = await handlePnl(address);
      await ctx.conversation.sendText(pnlToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/defi", "DeFi positions report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /defi 0x<address>"); return; }
    try {
      const report = await handleDefi(address);
      await ctx.conversation.sendText(defiToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/history", "Transaction history report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /history 0x<address>"); return; }
    try {
      const report = await handleHistory(address);
      await ctx.conversation.sendText(historyToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/nft", "NFT portfolio report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /nft 0x<address>"); return; }
    try {
      const report = await handleNft(address);
      await ctx.conversation.sendText(nftToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/compare", "Compare two wallets ($0.05)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const addresses = text.match(/0x[a-fA-F0-9]{40}/g);
    if (!addresses || addresses.length < 2) { await ctx.conversation.sendText("Usage: /compare 0x<addressA> 0x<addressB>"); return; }
    try {
      const report = await handleCompare(addresses[0], addresses[1]);
      await ctx.conversation.sendText(compareToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  // Handle payment confirmation
  agent.on("transaction-reference", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
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
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    await ctx.conversation.sendText(
      `👋 OWS Intelligence Wire\n\n` +
      `📊 Analytics:\n` +
      `  /quick 0x<addr>  — portfolio snapshot ($0.01)\n` +
      `  /research 0x<addr> — deep research ($0.05)\n` +
      `  /pnl 0x<addr>  — profit & loss ($0.02)\n` +
      `  /defi 0x<addr>  — DeFi positions ($0.02)\n` +
      `  /history 0x<addr> — tx history ($0.02)\n` +
      `  /nft 0x<addr>  — NFT portfolio ($0.02)\n` +
      `  /compare 0x<a> 0x<b> — compare wallets ($0.05)\n\n` +
      `Payments via x402 (USDC on Base, gasless).`
    );
  });

  agent.use(router.middleware());

  await agent.start();
  console.log(`[xmtp] Agent online: ${agent.address}`);

  return agent;
}
