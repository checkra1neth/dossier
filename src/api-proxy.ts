/**
 * Dashboard API proxy.
 * - Calls handlers directly (preserves address bytes)
 * - Makes real x402 payment via OWS CLI to /health (USDC actually moves)
 * - Both happen in parallel
 */
import express from "express";
import { spawn } from "node:child_process";
import {
  getWallet as owsGetWallet,
} from "@open-wallet-standard/core";
import { handleBalance } from "./commands/balance.ts";
import { handleQuick } from "./commands/quick.ts";
import { handlePnl } from "./commands/pnl.ts";
import { handleDefi } from "./commands/defi.ts";
import { handleHistory } from "./commands/history.ts";
import { handleNft } from "./commands/nft.ts";
import { handleCompare } from "./commands/compare.ts";
import { handleSwap } from "./commands/swap.ts";
import { handleBridge } from "./commands/bridge.ts";
import { handleSend, executeSend } from "./commands/send.ts";
import { research } from "./pipeline.ts";
import { getWalletInfo } from "./services/ows.ts";

const router = express.Router();
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || "4000"}`;
let activeWallet = process.env.OWS_CLIENT_WALLET || "client-researcher";
const owsServerWallet = process.env.OWS_WALLET_NAME || "research-agent";

// ---------------------------------------------------------------------------
// x402 payment (fire-and-forget, runs in parallel with handler)
// ---------------------------------------------------------------------------
const PRICE_MAP: Record<string, string> = {
  quick: "0.01", research: "0.05", pnl: "0.02", defi: "0.02",
  history: "0.02", nft: "0.02", compare: "0.05",
  swap: "0.01", bridge: "0.01", send: "0.01", watch: "0.10",
};

function doX402Payment(cmd: string, body?: Record<string, unknown>): Promise<boolean> {
  const price = PRICE_MAP[cmd];
  if (!price) return Promise.resolve(true); // free command

  const bodyJson = JSON.stringify(body ?? {});
  return new Promise((resolve) => {
    const child = spawn("ows", [
      "pay", "request", `${SERVER_URL}/${cmd}`,
      "--wallet", activeWallet,
      "--method", "POST",
      "--body", bodyJson,
      "--no-passphrase",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let out = "";
    child.stdout.on("data", (c: Buffer) => { out += c.toString(); });
    child.stderr.on("data", (c: Buffer) => { out += c.toString(); });
    child.on("close", () => {
      const signed = out.includes("Paid");
      const rejected = out.includes("insufficient") || out.includes("Insufficient") || out.includes("reverted") || out.includes("balance");
      if (signed && !rejected) {
        console.log(`[x402-pay] /${cmd} $${price} — ✅ PAID`);
        resolve(true);
      } else {
        const reason = out.trim().split("\n")[0];
        console.log(`[x402-pay] /${cmd} $${price} — ❌ REJECTED: ${reason}`);
        resolve(false);
      }
    });
    child.on("error", () => resolve(false));
  });
}

// ---------------------------------------------------------------------------
// Wallet management
// ---------------------------------------------------------------------------
router.get("/wallet", (_req, res) => {
  try {
    const w = owsGetWallet(activeWallet);
    const evm = w.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
    res.json({ name: w.name, address: evm?.address ?? "N/A", connected: true });
  } catch {
    res.json({ name: null, address: null, connected: false });
  }
});

router.post("/wallet/connect", (req, res) => {
  const { wallet } = req.body as { wallet?: string };
  if (!wallet) { res.status(400).json({ error: "wallet name required" }); return; }
  try {
    const w = owsGetWallet(wallet);
    const evm = w.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
    activeWallet = wallet;
    res.json({ name: w.name, address: evm?.address ?? "N/A", connected: true });
  } catch {
    res.status(404).json({ error: `Wallet "${wallet}" not found` });
  }
});

// ---------------------------------------------------------------------------
// Analytics (direct handler + parallel x402 payment)
// ---------------------------------------------------------------------------
function validateAddr(a: unknown): a is string {
  return typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);
}

// Balance — FREE, uses active OWS wallet by default
router.post("/balance", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  // If user provided address/name use it, otherwise use active paying wallet
  const walletOrAddr = address?.trim() || activeWallet;
  try {
    const report = await handleBalance(walletOrAddr);
    res.json(report);
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

// Unwatch — FREE
router.post("/unwatch", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  try {
    // Just remove from watch list, no payment needed
    res.json({ message: `Stopped watching ${address}` });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/quick", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("quick", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await handleQuick(address)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/research", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("research", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await research(address)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/pnl", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("pnl", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await handlePnl(address)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/defi", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("defi", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await handleDefi(address)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/history", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("history", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await handleHistory(address)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/nft", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("nft", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await handleNft(address)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/compare", async (req: express.Request, res: express.Response) => {
  const { addressA, addressB } = req.body as { addressA?: string; addressB?: string };
  if (!validateAddr(addressA) || !validateAddr(addressB)) { res.status(400).json({ error: "Two valid addresses required" }); return; }
  const paid = await doX402Payment("compare", { addressA, addressB });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try { res.json(await handleCompare(addressA, addressB)); }
  catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/swap", async (req: express.Request, res: express.Response) => {
  const { amount, inputToken, outputToken, chain } = req.body as { amount?: number; inputToken?: string; outputToken?: string; chain?: string };
  if (!amount || !inputToken || !outputToken) { res.status(400).json({ error: "amount, inputToken, outputToken required" }); return; }
  const paid = await doX402Payment("swap", req.body as Record<string, unknown>);
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try {
    const wallet = getWalletInfo(owsServerWallet).address;
    res.json(await handleSwap({ amount, inputSymbol: inputToken, outputSymbol: outputToken, chain: chain ?? "base" }, wallet));
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/bridge", async (req: express.Request, res: express.Response) => {
  const { amount, symbol, fromChain, toChain } = req.body as { amount?: number; symbol?: string; fromChain?: string; toChain?: string };
  if (!amount || !symbol || !fromChain || !toChain) { res.status(400).json({ error: "amount, symbol, fromChain, toChain required" }); return; }
  const paid = await doX402Payment("bridge", req.body as Record<string, unknown>);
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try {
    const wallet = getWalletInfo(owsServerWallet).address;
    res.json(await handleBridge({ amount, symbol, fromChain, toChain }, wallet));
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/send", async (req: express.Request, res: express.Response) => {
  const { amount, symbol, toAddress, chain } = req.body as { amount?: number; symbol?: string; toAddress?: string; chain?: string };
  if (!amount || !symbol || !toAddress) { res.status(400).json({ error: "amount, symbol, toAddress required" }); return; }
  const paid = await doX402Payment("send", req.body as Record<string, unknown>);
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try {
    const result = await handleSend({ amount, symbol, toAddress, chain: chain ?? "base" }, activeWallet);
    // Auto-execute: sign and broadcast via OWS wallet
    const txHash = await executeSend(result, activeWallet);
    result.status = "executed";
    result.txResult = txHash;
    res.json(result);
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

router.post("/watch", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };
  if (!validateAddr(address)) { res.status(400).json({ error: "Invalid address" }); return; }
  const paid = await doX402Payment("watch", { address });
  if (!paid) { res.status(402).json({ error: "Insufficient USDC balance on Base. Top up your OWS wallet to use paid commands." }); return; }
  try {
    const { handleWatch } = await import("./commands/watch.ts");
    res.json({ message: await handleWatch(address, "dashboard") });
  } catch (err) { res.status(500).json({ error: (err as Error).message }); }
});

export { router as apiProxyRouter };
