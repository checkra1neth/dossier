import express from "express";
import { createWireAgent, sendToGroup, makeWireMessage, wireMessageHandler, onWireMessage } from "@wire/shared/xmtp";
import { PORTS } from "@wire/shared/config";
import { sseHandler, broadcastSSE } from "@wire/shared/sse";
import type { RawEvent } from "@wire/shared/types";
import { startAlliumStream } from "./allium.ts";
import type { AlliumTx } from "./allium.ts";

const ETH_PRICE_USD = 3500;

async function main(): Promise<void> {
  const wireAgent = await createWireAgent("scanner");

  const app = express();
  app.use(express.json());

  // SSE endpoint for dashboard
  app.get("/events", sseHandler);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      agent: "scanner",
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
    console.log(`[scanner] Joined group: ${groupId}`);
    res.json({ ok: true, groupId });
  });

  // Wire message endpoint (receive messages from other agents)
  app.post("/wire-message", express.json(), wireMessageHandler(wireAgent));

  // Start Allium whale stream
  startAlliumStream(async (tx: AlliumTx) => {
    const valueEth = parseFloat(tx.value);
    const valueUsd = valueEth * ETH_PRICE_USD;

    // Filter out transactions below $100K
    if (valueUsd < 100_000) return;

    const rawEvent: RawEvent = {
      chain: tx.chain,
      txHash: tx.hash,
      from: tx.from,
      to: tx.to,
      valueUsd,
      type: "whale_transfer",
    };

    const wireMsg = makeWireMessage("scanner", "raw_event", rawEvent);

    // Broadcast to SSE clients (dashboard)
    broadcastSSE("scanner", wireMsg);

    // Send to wire group if joined
    try {
      await sendToGroup(wireAgent, wireMsg);
    } catch {
      // Group not set yet or send failed — that's ok
    }

    console.log(
      `[scanner] Whale tx: ${valueEth.toFixed(2)} ETH ($${valueUsd.toLocaleString()}) from ${tx.from.slice(0, 10)}...`
    );
  });

  const port = PORTS.scanner;
  app.listen(port, () => {
    console.log(`[scanner] HTTP server on :${port}`);
  });
}

main().catch((err) => {
  console.error("[scanner] Fatal:", err);
  process.exit(1);
});
