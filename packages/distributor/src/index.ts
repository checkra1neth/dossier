import express from "express";
import {
  createWireAgent,
  sendToGroup,
  sendDM,
  makeWireMessage,
  onWireMessage,
  wireMessageHandler,
} from "@wire/shared/xmtp";
import { PORTS } from "@wire/shared/config";
import { sseHandler, broadcastSSE } from "@wire/shared/sse";
import type { Signal, StatusUpdate } from "@wire/shared/types";
import {
  addSubscriber,
  removeSubscriber,
  getSubscribers,
  getSubscriberCount,
  isSubscribed,
} from "./subscribers.ts";

function formatAlert(signal: Signal): string {
  return [
    `--- Intelligence Wire Alert ---`,
    `Action: ${signal.action}`,
    `Asset: ${signal.asset}`,
    `Confidence: ${(signal.confidence * 100).toFixed(0)}%`,
    `Reasoning: ${signal.reasoning}`,
    `Tx: ${signal.basedOn}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const wireAgent = await createWireAgent("distributor");

  const app = express();
  app.use(express.json());

  // SSE endpoint for dashboard
  app.get("/events", sseHandler);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      agent: "distributor",
      status: "ok",
      address: wireAgent.address,
      groupId: wireAgent.groupId,
      subscriberCount: getSubscriberCount(),
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
    console.log(`[distributor] Joined group: ${groupId}`);
    res.json({ ok: true, groupId });
  });

  // Wire message endpoint (receive messages from other agents)
  app.post("/wire-message", express.json(), wireMessageHandler(wireAgent));

  // DM endpoint — replaces XMTP DM handling
  app.post("/dm", async (req, res) => {
    const { address, text } = req.body as { address: string; text: string };
    if (!address || !text) {
      res.status(400).json({ error: "address and text required" });
      return;
    }

    const command = text.trim().toLowerCase();

    if (command === "/subscribe") {
      const added = addSubscriber(address);
      const reply = added
        ? `Subscribed! You'll receive Intelligence Wire alerts via DM.`
        : `You're already subscribed.`;
      await sendDM(wireAgent, address, reply);
      res.json({ ok: true, reply });
    } else if (command === "/unsubscribe") {
      const removed = removeSubscriber(address);
      const reply = removed
        ? `Unsubscribed. You'll no longer receive alerts.`
        : `You're not currently subscribed.`;
      await sendDM(wireAgent, address, reply);
      res.json({ ok: true, reply });
    } else if (command === "/status") {
      const subscribed = isSubscribed(address);
      const reply = [
        `Intelligence Wire Distributor`,
        `Status: ${subscribed ? "Subscribed" : "Not subscribed"}`,
        `Total subscribers: ${getSubscriberCount()}`,
      ].join("\n");
      await sendDM(wireAgent, address, reply);
      res.json({ ok: true, reply });
    } else {
      const reply = `Available commands:\n/subscribe — receive alerts\n/unsubscribe — stop alerts\n/status — check status`;
      await sendDM(wireAgent, address, reply);
      res.json({ ok: true, reply });
    }
  });

  // Listen for wire messages — broadcast signals to subscribers
  onWireMessage(wireAgent, async (wireMsg) => {
    if (wireMsg.type !== "signal") return;

    const signal = wireMsg.data as Signal;
    const alertText = formatAlert(signal);
    const subscribers = getSubscribers();

    let sentCount = 0;
    for (const sub of subscribers) {
      try {
        await sendDM(wireAgent, sub.address, alertText);
        sentCount++;
      } catch (err) {
        console.error(`[distributor] Failed to DM ${sub.address}:`, err);
      }
    }

    console.log(`[distributor] Broadcast signal to ${sentCount}/${subscribers.length} subscribers`);

    // Status update
    const statusData: StatusUpdate = {
      message: `Broadcast ${signal.action} ${signal.asset} to ${sentCount} subscribers`,
      subscriberCount: getSubscriberCount(),
    };
    const statusMsg = makeWireMessage("distributor", "status", statusData);
    broadcastSSE("distributor", statusMsg);

    try {
      await sendToGroup(wireAgent, statusMsg);
    } catch {
      // Group send failed — ok
    }
  });

  const port = PORTS.distributor;
  app.listen(port, () => {
    console.log(`[distributor] HTTP server on :${port}`);
  });

  console.log("[distributor] Wire message listener active");
}

main().catch((err) => {
  console.error("[distributor] Fatal:", err);
  process.exit(1);
});
