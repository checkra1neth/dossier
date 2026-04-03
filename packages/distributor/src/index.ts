import express from "express";
import { createWireAgent, sendToGroup, makeWireMessage, parseWireMessage } from "@wire/shared/xmtp";
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
  const agent = wireAgent.agent;

  const app = express();
  app.use(express.json());

  // SSE endpoint for dashboard
  app.get("/events", sseHandler);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      agent: "distributor",
      status: "ok",
      xmtpAddress: agent.address,
      groupId: wireAgent.groupId,
      subscriberCount: getSubscriberCount(),
    });
  });

  // XMTP address
  app.get("/address", (_req, res) => {
    res.json({ address: agent.address });
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

  // Listen for group messages — broadcast signals to subscribers
  agent.on("group", async (ctx) => {
    const text = ctx.message?.text;
    if (!text) return;

    const wireMsg = parseWireMessage(text);
    if (!wireMsg || wireMsg.type !== "signal") return;

    const signal = wireMsg.data as Signal;
    const alertText = formatAlert(signal);
    const subscribers = getSubscribers();

    let sentCount = 0;
    for (const sub of subscribers) {
      try {
        const dm = await agent.client.conversations.newDmWithAddress(sub.address);
        await dm.send(alertText);
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

  // Listen for DMs — handle subscriber commands
  agent.on("dm", async (ctx) => {
    const text = ctx.message?.text?.trim();
    if (!text) return;

    const senderAddress = ctx.getSenderAddress();
    const command = text.toLowerCase();

    if (command === "/subscribe") {
      const added = addSubscriber(senderAddress);
      const reply = added
        ? `Subscribed! You'll receive Intelligence Wire alerts via DM.`
        : `You're already subscribed.`;
      await ctx.conversation.sendText(reply);
    } else if (command === "/unsubscribe") {
      const removed = removeSubscriber(senderAddress);
      const reply = removed
        ? `Unsubscribed. You'll no longer receive alerts.`
        : `You're not currently subscribed.`;
      await ctx.conversation.sendText(reply);
    } else if (command === "/status") {
      const subscribed = isSubscribed(senderAddress);
      const reply = [
        `Intelligence Wire Distributor`,
        `Status: ${subscribed ? "Subscribed" : "Not subscribed"}`,
        `Total subscribers: ${getSubscriberCount()}`,
      ].join("\n");
      await ctx.conversation.sendText(reply);
    } else {
      await ctx.conversation.sendText(
        `Available commands:\n/subscribe — receive alerts\n/unsubscribe — stop alerts\n/status — check status`
      );
    }
  });

  const port = PORTS.distributor;
  app.listen(port, () => {
    console.log(`[distributor] HTTP server on :${port}`);
  });

  await agent.start();
  console.log(`[distributor] XMTP agent listening for messages`);
}

main().catch((err) => {
  console.error("[distributor] Fatal:", err);
  process.exit(1);
});
