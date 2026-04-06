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
  importWalletPrivateKey as owsImportKey,
  exportWallet as owsExportWallet,
} from "@open-wallet-standard/core";
import { research } from "./pipeline.ts";
import { reportToMarkdown } from "./report.ts";
import { handleQuick, quickToText } from "./commands/quick.ts";
import { handlePnl, pnlToText } from "./commands/pnl.ts";
import { handleDefi, defiToText } from "./commands/defi.ts";
import { handleHistory, historyToText } from "./commands/history.ts";
import { handleNft, nftToText } from "./commands/nft.ts";
import { handleCompare, compareToText } from "./commands/compare.ts";
import { handleBalance, balanceToText } from "./commands/balance.ts";
import { parseSwapCommand, handleSwap, swapOfferToText, executeSwap } from "./commands/swap.ts";
import { parseBridgeCommand, handleBridge, bridgeOfferToText, executeSwap as executeBridge } from "./commands/bridge.ts";
import { parseSendCommand, handleSend, sendToText, executeSend } from "./commands/send.ts";
import { getWalletInfo } from "./services/ows.ts";
import { handleWatch, handleUnwatch } from "./commands/watch.ts";
import { handleSubscribe, handleUnsubscribe } from "./commands/subscribe.ts";

const CHAIN = base;
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
// Command prices in USDC
const COMMAND_PRICES: Record<string, string> = {
  research: "0.05", quick: "0.01", pnl: "0.02", defi: "0.02",
  history: "0.02", nft: "0.02", compare: "0.05",
  swap: "0.01", bridge: "0.01", send: "0.01", watch: "0.10",
};

// Relay inbox IDs that skip payment (already paid via x402 on dashboard)
const relayInboxIds = new Set<string>();

export function registerRelayInboxId(inboxId: string): void {
  relayInboxIds.add(inboxId);
  console.log(`[xmtp] Registered relay inbox: ${inboxId}`);
}

// Pending payment requests: conversationId → command to execute after payment
const pendingPayment = new Map<string, {
  command: string;
  execute: () => Promise<string>;
}>();

// Pending wallet action confirmations: conversationId → action
const pendingAction = new Map<string, {
  type: string;
  data: unknown;
  execute: () => Promise<string>;
}>();

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

  // Restore OWS wallet from env key (persistent across deploys) or create new
  const wallets = owsListWallets();
  if (!wallets.find((w: { name: string }) => w.name === owsWalletName)) {
    const privateKey = process.env.OWS_WALLET_PRIVATE_KEY;
    if (privateKey) {
      owsImportKey(owsWalletName, privateKey);
      console.log(`[xmtp] Imported OWS wallet "${owsWalletName}" from env key`);
    } else {
      owsCreateWallet(owsWalletName);
      const exported = owsExportWallet(owsWalletName);
      console.log(`[xmtp] Created NEW OWS wallet "${owsWalletName}". Set OWS_WALLET_PRIVATE_KEY=${exported} to persist!`);
    }
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

  // Helper: request XMTP-native payment or execute directly for relay
  async function paidCommand(
    ctx: Parameters<Parameters<typeof router.command>[2]>[0],
    cmd: string,
    description: string,
    execute: () => Promise<string>,
  ): Promise<void> {
    const isRelay = relayInboxIds.has(ctx.message.senderInboxId);
    if (isRelay) {
      // Relay already paid via x402 — execute directly
      try {
        const result = await execute();
        await ctx.conversation.sendText(result);
      } catch (err) {
        console.error(`[xmtp] ❌ /${cmd} failed:`, err);
        await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`);
      }
      return;
    }

    // Direct DM — request XMTP-native payment
    const price = COMMAND_PRICES[cmd];
    if (!price) {
      try {
        const result = await execute();
        await ctx.conversation.sendText(result);
      } catch (err) {
        console.error(`[xmtp] ❌ /${cmd} failed:`, err);
        await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`);
      }
      return;
    }

    const convId = ctx.conversation.id;
    pendingPayment.set(convId, { command: cmd, execute });

    const senderAddress = await ctx.getSenderAddress();
    const walletSendCalls = createERC20TransferCalls({
      chain: CHAIN,
      tokenAddress: USDC_CONTRACT,
      from: validHex(senderAddress),
      to: validHex(agent.address),
      amount: parseUnits(price, USDC_DECIMALS),
      description: `Pay $${price} USDC for /${cmd}: ${description}`,
    });

    await ctx.conversation.sendText(
      `💳 /${cmd} · $${price} USDC on Base\n${description}\n\nApprove the payment below.`
    );
    await ctx.conversation.sendWalletSendCalls(walletSendCalls);
    console.log(`[xmtp] Payment request for /${cmd} in ${convId}`);
  }

  router.command("/research", "Research a wallet address ($0.05 USDC)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /research 0x<address>"); return; }
    console.log(`[xmtp] /research ${address}`);
    await paidCommand(ctx, "research", address, async () => {
      await ctx.conversation.sendText(`🔍 Researching ${address.slice(0, 6)}...${address.slice(-4)}... This may take 10-20 seconds.`);
      const report = await research(address);
      return reportToMarkdown(report);
    });
  });

  router.command("/quick", "Quick portfolio snapshot ($0.01)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /quick 0x<address>"); return; }
    console.log(`[xmtp] /quick ${address}`);
    await paidCommand(ctx, "quick", address, async () => {
      const report = await handleQuick(address);
      console.log(`[xmtp] ✅ /quick done — $${report.portfolio.totalValueUsd.toLocaleString()}`);
      return quickToText(report);
    });
  });

  router.command("/pnl", "Profit & loss report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /pnl 0x<address>"); return; }
    console.log(`[xmtp] /pnl ${address}`);
    await paidCommand(ctx, "pnl", address, async () => {
      const report = await handlePnl(address);
      console.log(`[xmtp] ✅ /pnl done — ROI ${report.roi.toFixed(1)}%`);
      return pnlToText(report);
    });
  });

  router.command("/defi", "DeFi positions report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /defi 0x<address>"); return; }
    console.log(`[xmtp] /defi ${address}`);
    await paidCommand(ctx, "defi", address, async () => {
      const report = await handleDefi(address);
      console.log(`[xmtp] ✅ /defi done — ${report.positions.length} positions, $${report.totalDefiUsd.toLocaleString()}`);
      return defiToText(report);
    });
  });

  router.command("/history", "Transaction history report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /history 0x<address>"); return; }
    console.log(`[xmtp] /history ${address}`);
    await paidCommand(ctx, "history", address, async () => {
      const report = await handleHistory(address);
      console.log(`[xmtp] ✅ /history done — ${report.transactions.length} txns, ${report.frequency}`);
      return historyToText(report);
    });
  });

  router.command("/nft", "NFT portfolio report ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /nft 0x<address>"); return; }
    console.log(`[xmtp] /nft ${address}`);
    await paidCommand(ctx, "nft", address, async () => {
      const report = await handleNft(address);
      console.log(`[xmtp] ✅ /nft done — ${report.collections.length} collections, $${report.totalEstimatedUsd.toLocaleString()}`);
      return nftToText(report);
    });
  });

  router.command("/compare", "Compare two wallets ($0.05)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const addresses = text.match(/0x[a-fA-F0-9]{40}/g);
    if (!addresses || addresses.length < 2) { await ctx.conversation.sendText("Usage: /compare 0x<addressA> 0x<addressB>"); return; }
    console.log(`[xmtp] /compare ${addresses[0]} vs ${addresses[1]}`);
    await paidCommand(ctx, "compare", `${addresses[0]} vs ${addresses[1]}`, async () => {
      const report = await handleCompare(addresses[0], addresses[1]);
      console.log(`[xmtp] ✅ /compare done`);
      return compareToText(report);
    });
  });

  // -----------------------------------------------------------------------
  // Wallet action commands
  // -----------------------------------------------------------------------

  router.command("/balance", "Check your wallet balance (free)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    const target = address || await ctx.getSenderAddress() || owsWalletName;
    console.log(`[xmtp] /balance for ${target}`);
    try {
      const report = await handleBalance(target);
      console.log(`[xmtp] ✅ /balance done — $${report.totalUsd.toLocaleString()}`);
      await ctx.conversation.sendText(balanceToText(report));
    } catch (err) {
      console.error(`[xmtp] ❌ /balance failed:`, err);
      await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`);
    }
  });

  router.command("/swap", "Swap tokens ($0.01)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    console.log(`[xmtp] /swap ${text}`);

    const request = parseSwapCommand(text);
    if (!request) {
      await ctx.conversation.sendText("Usage: /swap <amount> <token> to <token> [on <chain>]\nExample: /swap 10 USDC to ETH on base");
      return;
    }

    try {
      const walletInfo = getWalletInfo(owsWalletName);
      const result = await handleSwap(request, walletInfo.address);

      const convId = ctx.conversation.id;
      pendingAction.set(convId, {
        type: "swap",
        data: result,
        execute: () => executeSwap(result.offer, owsWalletName, request.chain),
      });

      console.log(`[xmtp] ✅ /swap offer ready via ${result.offer.source}`);
      await ctx.conversation.sendText(swapOfferToText(request, result));
    } catch (err) {
      console.error(`[xmtp] ❌ /swap failed:`, err);
      await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`);
    }
  });

  router.command("/bridge", "Bridge tokens across chains ($0.01)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    console.log(`[xmtp] /bridge ${text}`);

    const request = parseBridgeCommand(text);
    if (!request) {
      await ctx.conversation.sendText("Usage: /bridge <amount> <token> from <chain> to <chain>\nExample: /bridge 100 USDC from base to ethereum");
      return;
    }

    try {
      const walletInfo = getWalletInfo(owsWalletName);
      const result = await handleBridge(request, walletInfo.address);

      const convId = ctx.conversation.id;
      pendingAction.set(convId, {
        type: "bridge",
        data: result,
        execute: () => executeBridge(result.offer, owsWalletName, request.fromChain),
      });

      console.log(`[xmtp] ✅ /bridge offer ready via ${result.offer.source}`);
      await ctx.conversation.sendText(bridgeOfferToText(request, result));
    } catch (err) {
      console.error(`[xmtp] ❌ /bridge failed:`, err);
      await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`);
    }
  });

  router.command("/send", "Send tokens to an address ($0.01)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    console.log(`[xmtp] /send ${text}`);

    const request = parseSendCommand(text);
    if (!request) {
      await ctx.conversation.sendText("Usage: /send <amount> <token> to <0xaddress> [on <chain>]\nExample: /send 10 USDC to 0xABC...123 on base");
      return;
    }

    try {
      const result = await handleSend(request, owsWalletName);

      const convId = ctx.conversation.id;
      pendingAction.set(convId, {
        type: "send",
        data: result,
        execute: () => executeSend(result, owsWalletName),
      });

      console.log(`[xmtp] ✅ /send prepared — ${request.amount} ${request.symbol} to ${request.toAddress}`);
      await ctx.conversation.sendText(sendToText(result));
    } catch (err) {
      console.error(`[xmtp] ❌ /send failed:`, err);
      await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`);
    }
  });

  // -----------------------------------------------------------------------
  // Monitoring commands
  // -----------------------------------------------------------------------

  router.command("/watch", "Watch a wallet for activity ($0.10)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /watch 0x<address>"); return; }
    console.log(`[xmtp] /watch ${address}`);
    try {
      const result = await handleWatch(address, ctx.conversation.id);
      console.log(`[xmtp] /watch done for ${address}`);
      await ctx.conversation.sendText(result);
    } catch (err) {
      console.error(`[xmtp] /watch failed:`, err);
      await ctx.conversation.sendText(`Error: ${err instanceof Error ? err.message : err}`);
    }
  });

  router.command("/unwatch", "Stop watching a wallet (free)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /unwatch 0x<address>"); return; }
    console.log(`[xmtp] /unwatch ${address}`);
    try {
      const result = await handleUnwatch(address);
      console.log(`[xmtp] /unwatch done for ${address}`);
      await ctx.conversation.sendText(result);
    } catch (err) {
      console.error(`[xmtp] /unwatch failed:`, err);
      await ctx.conversation.sendText(`Error: ${err instanceof Error ? err.message : err}`);
    }
  });

  router.command("/subscribe", "Subscribe to daily digest (free)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    console.log(`[xmtp] /subscribe`);
    const result = handleSubscribe(ctx.conversation.id);
    await ctx.conversation.sendText(result);
  });

  router.command("/unsubscribe", "Unsubscribe from daily digest (free)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    console.log(`[xmtp] /unsubscribe`);
    const result = handleUnsubscribe(ctx.conversation.id);
    await ctx.conversation.sendText(result);
  });

  // Handle payment confirmation — execute any pending paid command
  agent.on("transaction-reference", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const { networkId, reference } = ctx.message.content;
    const chainId = hexToNumber(validHex(networkId));
    const convId = ctx.conversation.id;

    console.log(`[xmtp] Transaction confirmed: chain=${chainId} tx=${reference}`);

    const pending = pendingPayment.get(convId);
    if (!pending) {
      await ctx.conversation.sendText(`✅ Payment received! (tx: ${reference})\n\nNo pending command. Send a command first.`);
      return;
    }

    pendingPayment.delete(convId);

    await ctx.conversation.sendText(`✅ Payment confirmed! (tx: ${reference})\n\nProcessing /${pending.command}...`);

    try {
      const result = await pending.execute();
      await ctx.conversation.sendText(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[xmtp] ❌ /${pending.command} failed after payment:`, msg);
      await ctx.conversation.sendText(`❌ /${pending.command} failed: ${msg}`);
    }
  });

  router.default(async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;

    const text = (ctx.message.content as string).trim().toLowerCase();
    const convId = ctx.conversation.id;

    // Handle confirm/cancel for pending wallet actions
    if (text === "confirm") {
      const action = pendingAction.get(convId);
      if (!action) {
        await ctx.conversation.sendText("Nothing to confirm.");
        return;
      }
      pendingAction.delete(convId);
      console.log(`[xmtp] Confirming ${action.type}...`);
      try {
        const txResult = await action.execute();
        console.log(`[xmtp] ✅ ${action.type} executed — ${txResult}`);
        await ctx.conversation.sendText(`✅ ${action.type} executed!\n${txResult}`);
      } catch (err) {
        console.error(`[xmtp] ❌ ${action.type} execution failed:`, err);
        await ctx.conversation.sendText(`❌ ${action.type} failed: ${err instanceof Error ? err.message : err}`);
      }
      return;
    }

    if (text === "cancel") {
      const action = pendingAction.get(convId);
      pendingAction.delete(convId);
      if (action) {
        console.log(`[xmtp] Cancelled ${action.type}`);
        await ctx.conversation.sendText(`Cancelled ${action.type}.`);
      } else {
        await ctx.conversation.sendText("Nothing to cancel.");
      }
      return;
    }

    await ctx.conversation.sendText(
      `Dossier\n\n` +
      `Analytics:\n` +
      `  /quick 0x<addr>  — portfolio snapshot ($0.01)\n` +
      `  /research 0x<addr> — deep research ($0.05)\n` +
      `  /pnl 0x<addr>  — profit & loss ($0.02)\n` +
      `  /defi 0x<addr>  — DeFi positions ($0.02)\n` +
      `  /history 0x<addr> — tx history ($0.02)\n` +
      `  /nft 0x<addr>  — NFT portfolio ($0.02)\n` +
      `  /compare 0x<a> 0x<b> — compare wallets ($0.05)\n\n` +
      `Wallet actions:\n` +
      `  /balance — check wallet balance (free)\n` +
      `  /swap <amt> <token> to <token> [on <chain>] ($0.01)\n` +
      `  /bridge <amt> <token> from <chain> to <chain> ($0.01)\n` +
      `  /send <amt> <token> to <0xaddr> [on <chain>] ($0.01)\n\n` +
      `Monitoring:\n` +
      `  /watch 0x<addr>  — watch wallet activity ($0.10)\n` +
      `  /unwatch 0x<addr> — stop watching (free)\n` +
      `  /subscribe — daily digest (free, coming soon)\n` +
      `  /unsubscribe — stop daily digest (free)\n\n` +
      `Payments via USDC on Base. DM from any XMTP client!`
    );
  });

  agent.use(router.middleware());

  await agent.start();
  console.log(`[xmtp] Agent online: ${agent.address}`);

  // Periodic sync to discover new conversations (relay DMs from dashboard users)
  setInterval(async () => {
    try {
      await agent.client.conversations.syncAll();
    } catch (err) {
      console.error(`[xmtp] Periodic sync failed:`, (err as Error).message);
    }
  }, 10_000);

  return agent;
}

/**
 * Send a text message to an XMTP conversation by ID.
 * Used by the webhook handler to deliver wallet activity alerts.
 */
export async function sendToConversation(
  agent: Agent,
  conversationId: string,
  text: string,
): Promise<void> {
  const ctx = await agent.getConversationContext(conversationId);
  if (!ctx) {
    throw new Error(`Conversation ${conversationId} not found`);
  }
  await ctx.conversation.sendText(text);
}
