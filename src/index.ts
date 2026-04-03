import "dotenv/config";
import express from "express";
import {
  paymentMiddleware,
  paymentMiddlewareFromConfig,
  x402ResourceServer,
} from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import {
  getWallet as owsGetWallet,
  createWallet as owsCreateWallet,
  listWallets as owsListWallets,
} from "@open-wallet-standard/core";
import { research } from "./pipeline.ts";
import { handleQuick } from "./commands/quick.ts";
import { handlePnl } from "./commands/pnl.ts";
import { handleDefi } from "./commands/defi.ts";
import { handleHistory } from "./commands/history.ts";
import { handleNft } from "./commands/nft.ts";
import { handleCompare } from "./commands/compare.ts";
import { handleBalance } from "./commands/balance.ts";
import { handleSwap } from "./commands/swap.ts";
import { handleBridge } from "./commands/bridge.ts";
import { handleSend } from "./commands/send.ts";
import { getWalletInfo } from "./services/ows.ts";

// Prevent server crash on unhandled errors
process.on("unhandledRejection", (err) => {
  console.error("[server] Unhandled rejection:", err instanceof Error ? err.message : err);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err.message);
});

const app = express();
app.use(express.json());

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ows-deep-research", uptime: process.uptime() });
});

// OWS wallet for receiving payments
const owsWalletName = process.env.OWS_WALLET_NAME || "research-agent";
const wallets = owsListWallets();
if (!wallets.find((w: { name: string }) => w.name === owsWalletName)) {
  owsCreateWallet(owsWalletName);
}
const owsWallet = owsGetWallet(owsWalletName);
const evmAccount = owsWallet?.accounts.find((a: { chainId: string }) => a.chainId.startsWith("eip155:"));
const payTo = evmAccount?.address ?? "";

// x402 payment setup — Base mainnet
const facilitatorUrl = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const network = (process.env.CHAIN_NETWORK ?? "eip155:8453") as Network;

console.log(`[ows] Wallet "${owsWalletName}" → ${payTo}`);
console.log(`[x402] Network: ${network}, payTo: ${payTo}`);

const researchRouter = express.Router();

researchRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — research request for ${address}`);

  try {
    const report = await research(address);
    console.log(`[api] ✅ Report sent for ${address}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ Research failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const quickRouter = express.Router();

quickRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — quick request for ${address}`);

  try {
    const report = await handleQuick(address);
    console.log(`[api] ✅ Quick report sent for ${address}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ Quick failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const pnlRouter = express.Router();

pnlRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — pnl request for ${address}`);

  try {
    const report = await handlePnl(address);
    console.log(`[api] ✅ PnL report sent for ${address}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ PnL failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const defiRouter = express.Router();

defiRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — defi request for ${address}`);

  try {
    const report = await handleDefi(address);
    console.log(`[api] ✅ DeFi report sent for ${address}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ DeFi failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const historyRouter = express.Router();

historyRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — history request for ${address}`);

  try {
    const report = await handleHistory(address);
    console.log(`[api] ✅ History report sent for ${address}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ History failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const nftRouter = express.Router();

nftRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — nft request for ${address}`);

  try {
    const report = await handleNft(address);
    console.log(`[api] ✅ NFT report sent for ${address}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ NFT failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const compareRouter = express.Router();

compareRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { addressA, addressB } = req.body as { addressA?: string; addressB?: string };

  if (!addressA?.match(/^0x[a-fA-F0-9]{40}$/) || !addressB?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid addresses. Provide two valid 0x Ethereum addresses (addressA, addressB)." });
    return;
  }

  console.log(`[x402] ✅ Payment verified — compare request for ${addressA} vs ${addressB}`);

  try {
    const report = await handleCompare(addressA, addressB);
    console.log(`[api] ✅ Compare report sent for ${addressA} vs ${addressB}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ Compare failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

// /balance — FREE (reads own wallet, no payment needed)
app.get("/balance", async (req: express.Request, res: express.Response) => {
  const walletName = (req.query.wallet as string) || process.env.OWS_WALLET_NAME || "research-agent";
  console.log(`[api] /balance for wallet "${walletName}"`);
  try {
    const report = await handleBalance(walletName);
    console.log(`[api] ✅ /balance done — $${report.totalUsd.toLocaleString()}`);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ /balance failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const swapRouter = express.Router();

swapRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { amount, inputToken, outputToken, chain, walletAddress } = req.body as {
    amount?: number;
    inputToken?: string;
    outputToken?: string;
    chain?: string;
    walletAddress?: string;
  };

  if (!amount || !inputToken || !outputToken) {
    res.status(400).json({ error: "Required: amount, inputToken, outputToken" });
    return;
  }

  const resolvedChain = chain ?? "base";
  const wallet = walletAddress ?? getWalletInfo(owsWalletName).address;

  console.log(`[x402] ✅ Payment verified — swap ${amount} ${inputToken} -> ${outputToken} on ${resolvedChain}`);

  try {
    const result = await handleSwap(
      { amount, inputSymbol: inputToken, outputSymbol: outputToken, chain: resolvedChain },
      wallet,
    );
    console.log(`[api] ✅ Swap offer ready via ${result.offer.source}`);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ Swap failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const bridgeRouter = express.Router();

bridgeRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { amount, symbol, fromChain, toChain, walletAddress } = req.body as {
    amount?: number;
    symbol?: string;
    fromChain?: string;
    toChain?: string;
    walletAddress?: string;
  };

  if (!amount || !symbol || !fromChain || !toChain) {
    res.status(400).json({ error: "Required: amount, symbol, fromChain, toChain" });
    return;
  }

  const wallet = walletAddress ?? getWalletInfo(owsWalletName).address;

  console.log(`[x402] ✅ Payment verified — bridge ${amount} ${symbol} from ${fromChain} to ${toChain}`);

  try {
    const result = await handleBridge(
      { amount, symbol, fromChain, toChain },
      wallet,
    );
    console.log(`[api] ✅ Bridge offer ready via ${result.offer.source}`);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ Bridge failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

const sendRouter = express.Router();

sendRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { amount, symbol, toAddress, chain } = req.body as {
    amount?: number;
    symbol?: string;
    toAddress?: string;
    chain?: string;
  };

  if (!amount || !symbol || !toAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Required: amount, symbol, toAddress (valid 0x address)" });
    return;
  }

  const resolvedChain = chain ?? "base";

  console.log(`[x402] ✅ Payment verified — send ${amount} ${symbol} to ${toAddress} on ${resolvedChain}`);

  try {
    const result = await handleSend(
      { amount, symbol, toAddress, chain: resolvedChain },
      owsWalletName,
    );
    console.log(`[api] ✅ Send prepared — ${amount} ${symbol} to ${toAddress}`);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] ❌ Send failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

try {
  const cdpKeyId = process.env.CDP_API_KEY_ID;
  const cdpKeySecret = process.env.CDP_API_KEY_SECRET;

  const baseFacilitatorClient = (cdpKeyId && cdpKeySecret)
    ? new HTTPFacilitatorClient({
        url: facilitatorUrl,
        createAuthHeaders: async () => {
          const { generateJwt } = await import("@coinbase/cdp-sdk/auth");
          const facilitatorHost = new URL(facilitatorUrl).host;
          const basePath = new URL(facilitatorUrl).pathname;

          const mkJwt = (method: string, path: string) =>
            generateJwt({
              apiKeyId: cdpKeyId,
              apiKeySecret: cdpKeySecret,
              requestMethod: method,
              requestHost: facilitatorHost,
              requestPath: path,
            });

          const [verifyToken, settleToken, supportedToken] = await Promise.all([
            mkJwt("POST", `${basePath}/verify`),
            mkJwt("POST", `${basePath}/settle`),
            mkJwt("GET", `${basePath}/supported`),
          ]);

          return {
            verify: { Authorization: `Bearer ${verifyToken}` },
            settle: { Authorization: `Bearer ${settleToken}` },
            supported: { Authorization: `Bearer ${supportedToken}` },
          };
        },
      })
    : new HTTPFacilitatorClient({ url: facilitatorUrl });

  const facilitatorClient = baseFacilitatorClient;

  const routes = {
    "POST /research": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.05" as const,
      },
      description: "Deep wallet research report",
      mimeType: "application/json",
    },
    "POST /quick": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.01" as const,
      },
      description: "Quick portfolio snapshot",
      mimeType: "application/json",
    },
    "POST /pnl": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.02" as const,
      },
      description: "Profit & loss report",
      mimeType: "application/json",
    },
    "POST /defi": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.02" as const,
      },
      description: "DeFi positions report",
      mimeType: "application/json",
    },
    "POST /history": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.02" as const,
      },
      description: "Transaction history report",
      mimeType: "application/json",
    },
    "POST /nft": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.02" as const,
      },
      description: "NFT portfolio report",
      mimeType: "application/json",
    },
    "POST /compare": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.05" as const,
      },
      description: "Compare two wallets",
      mimeType: "application/json",
    },
    "POST /swap": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.01" as const,
      },
      description: "Swap tokens via DEX aggregator",
      mimeType: "application/json",
    },
    "POST /bridge": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.01" as const,
      },
      description: "Bridge tokens across chains",
      mimeType: "application/json",
    },
    "POST /send": {
      accepts: {
        scheme: "exact" as const,
        network,
        payTo,
        price: "$0.01" as const,
      },
      description: "Send tokens to an address",
      mimeType: "application/json",
    },
  };

  app.use(
    paymentMiddlewareFromConfig(routes, facilitatorClient, [
      { network: network as Network, server: new ExactEvmScheme() },
    ]),
  );
  console.log(`[x402] Payment middleware loaded — POST /research costs $0.05 (CDP auth: ${cdpKeyId ? "yes" : "no"})`);
} catch (err) {
  console.warn("[x402] Payment middleware unavailable, serving without gate:", (err as Error).message);
}

app.use("/research", researchRouter);
app.use("/quick", quickRouter);
app.use("/pnl", pnlRouter);
app.use("/defi", defiRouter);
app.use("/history", historyRouter);
app.use("/nft", nftRouter);
app.use("/compare", compareRouter);
app.use("/swap", swapRouter);
app.use("/bridge", bridgeRouter);
app.use("/send", sendRouter);

// Start servers
const port = parseInt(process.env.PORT ?? "4000");

app.listen(port, () => {
  console.log(`[server] REST API listening on http://localhost:${port}`);
  console.log(`[server] Analytics:`);
  console.log(`[server]   POST /quick    — $0.01 via x402`);
  console.log(`[server]   POST /research — $0.05 via x402`);
  console.log(`[server]   POST /pnl      — $0.02 via x402`);
  console.log(`[server]   POST /defi     — $0.02 via x402`);
  console.log(`[server]   POST /history  — $0.02 via x402`);
  console.log(`[server]   POST /nft      — $0.02 via x402`);
  console.log(`[server]   POST /compare  — $0.05 via x402`);
  console.log(`[server] Wallet actions:`);
  console.log(`[server]   GET  /balance  — free`);
  console.log(`[server]   POST /swap     — $0.01 via x402`);
  console.log(`[server]   POST /bridge   — $0.01 via x402`);
  console.log(`[server]   POST /send     — $0.01 via x402`);
  console.log(`[server] GET  /health`);
});

// Start XMTP agent (dynamic import to avoid crashing if native bindings fail)
(async () => {
  try {
    const { startXmtpAgent } = await import("./xmtp.ts");
    const agent = await startXmtpAgent();
    console.log(`[server] XMTP DM interface ready — address: ${agent.address}`);
  } catch (err) {
    console.warn("[xmtp] Agent failed to start:", (err as Error).message);
    console.warn("[xmtp] REST API still available without XMTP interface");
  }
})();
