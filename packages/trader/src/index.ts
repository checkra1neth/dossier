import express from "express";
import {
  createWireAgent,
  sendToGroup,
  makeWireMessage,
  onWireMessage,
  wireMessageHandler,
} from "@wire/shared/xmtp";
import { PORTS } from "@wire/shared/config";
import { sseHandler, broadcastSSE } from "@wire/shared/sse";
import type { Signal, TradeResult } from "@wire/shared/types";
import { executeMyriadTrade } from "./myriad.ts";
import { getDFlowQuote } from "./dflow.ts";
import { executeMoonPaySwap } from "./moonpay.ts";
import { executeRipplePayment } from "./ripple.ts";

async function executeAllPlatforms(signal: Signal): Promise<TradeResult[]> {
  const results = await Promise.allSettled([
    executeMyriadTrade(signal),
    getDFlowQuote(signal),
    executeMoonPaySwap(signal),
    executeRipplePayment(signal),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<TradeResult> => r.status === "fulfilled")
    .map((r) => r.value);
}

async function main(): Promise<void> {
  const wireAgent = await createWireAgent("trader");

  const app = express();
  app.use(express.json());

  // SSE endpoint for dashboard
  app.get("/events", sseHandler);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      agent: "trader",
      status: "ok",
      address: wireAgent.address,
      groupId: wireAgent.groupId,
    });
  });

  // Address
  app.get("/address", (_req, res) => {
    res.json({ address: wireAgent.address });
  });

  // Join group
  app.post("/group", (req, res) => {
    const { groupId } = req.body as { groupId: string };
    if (!groupId) {
      res.status(400).json({ error: "groupId required" });
      return;
    }
    wireAgent.groupId = groupId;
    console.log(`[trader] Joined group: ${groupId}`);
    res.json({ ok: true, groupId });
  });

  // Wire message endpoint (receive messages from other agents)
  app.post("/wire-message", express.json(), wireMessageHandler(wireAgent));

  // Listen for wire messages
  onWireMessage(wireAgent, async (wireMsg) => {
    if (wireMsg.type !== "signal") return;

    const signal = wireMsg.data as Signal;
    console.log(`[trader] Received signal: ${signal.action} ${signal.asset} (confidence: ${signal.confidence})`);

    // Execute on all 4 platforms in parallel
    const tradeResults = await executeAllPlatforms(signal);

    for (const result of tradeResults) {
      console.log(`[trader] ${result.platform}: ${result.action} — ${result.status}${result.txHash ? ` (tx: ${result.txHash})` : ""}`);

      const outMsg = makeWireMessage("trader", "trade_result", result);

      // Broadcast to SSE clients
      broadcastSSE("trader", outMsg);

      // Send to wire group
      try {
        await sendToGroup(wireAgent, outMsg);
      } catch {
        // Group not set yet or send failed
      }
    }
  });

  const port = PORTS.trader;
  app.listen(port, () => {
    console.log(`[trader] HTTP server on :${port}`);
  });

  console.log("[trader] Wire message listener active");
}

main().catch((err) => {
  console.error("[trader] Fatal:", err);
  process.exit(1);
});
