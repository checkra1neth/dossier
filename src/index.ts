import "dotenv/config";
import express from "express";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { privateKeyToAddress } from "viem/accounts";
import { research } from "./pipeline.ts";

const app = express();
app.use(express.json());

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ows-deep-research", uptime: process.uptime() });
});

// x402 payment setup
const facilitatorUrl = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const network = (process.env.CHAIN_NETWORK ?? "eip155:84532") as Network;
const payTo = process.env.WALLET_KEY
  ? privateKeyToAddress(process.env.WALLET_KEY as `0x${string}`)
  : "";

const researchRouter = express.Router();

researchRouter.post("/", async (req: express.Request, res: express.Response) => {
  const { address } = req.body as { address?: string };

  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Invalid address. Provide a valid 0x Ethereum address." });
    return;
  }

  try {
    const report = await research(address);
    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api] Research failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

try {
  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(network, new ExactEvmScheme());

  const routes = {
    "POST /research": {
      accepts: [{ scheme: "exact", price: "$0.05" as const, network, payTo }],
      description: "Deep wallet research report",
      mimeType: "application/json",
    },
  };

  app.use(paymentMiddleware(routes, resourceServer));
  console.log("[x402] Payment middleware loaded — POST /research costs $0.05");
} catch (err) {
  console.warn("[x402] Payment middleware unavailable, serving without gate:", (err as Error).message);
}

app.use("/research", researchRouter);

// Start servers
const port = parseInt(process.env.PORT ?? "4000");

app.listen(port, () => {
  console.log(`[server] REST API listening on http://localhost:${port}`);
  console.log(`[server] POST /research — $0.05 via x402`);
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
