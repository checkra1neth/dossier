import express from "express";
import type { RawEvent, EnrichedEvent } from "@wire/shared/types";
import { PORTS } from "@wire/shared/config";
import { sseHandler, broadcastSSE } from "@wire/shared/sse";
import {
  createWireAgent,
  sendToGroup,
  makeWireMessage,
  parseWireMessage,
} from "@wire/shared/xmtp";
import { getWalletProfile } from "./zerion.ts";

const app = express();
app.use(express.json());

app.get("/events", sseHandler);
app.get("/health", (_req, res) => {
  res.json({ agent: "enricher", status: "ok", uptime: process.uptime() });
});
app.get("/address", (_req, res) => {
  res.json({ address: wireAgent?.agent.address ?? null });
});
app.post("/group", async (req, res) => {
  const { groupId } = req.body as { groupId: string };
  if (wireAgent && groupId) {
    wireAgent.groupId = groupId;
    console.log(`[enricher] Joined group: ${groupId}`);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: "missing groupId or agent not ready" });
  }
});

let wireAgent: Awaited<ReturnType<typeof createWireAgent>> | null = null;

async function handleRawEvent(raw: RawEvent): Promise<void> {
  console.log(`[enricher] Enriching tx ${raw.txHash.slice(0, 10)}... from ${raw.from.slice(0, 10)}...`);

  const walletProfile = await getWalletProfile(raw.from);

  const enriched: EnrichedEvent = { ...raw, walletProfile };

  const msg = makeWireMessage("enricher", "enriched_event", enriched);
  broadcastSSE("enricher", msg);

  if (wireAgent?.groupId) {
    try {
      await sendToGroup(wireAgent, msg);
      console.log(
        `[enricher] Sent enriched event: $${walletProfile.totalValueUsd.toLocaleString()} wallet, smart_money=${walletProfile.isSmartMoney}`,
      );
    } catch (err) {
      console.error("[enricher] Failed to send to group:", err);
    }
  }
}

async function main(): Promise<void> {
  wireAgent = await createWireAgent("enricher");

  wireAgent.agent.on("message", async (msg) => {
    const text = typeof msg.content === "string" ? msg.content : String(msg.content);
    const wire = parseWireMessage(text);
    if (!wire) return;

    if (wire.type === "raw_event") {
      const rawEvent = wire.data as RawEvent;
      await handleRawEvent(rawEvent);
    }
  });

  await wireAgent.agent.start();
  console.log("[enricher] XMTP agent listening for messages");

  const port = PORTS.enricher;
  app.listen(port, () => {
    console.log(`[enricher] HTTP server on :${port}`);
  });
}

main().catch((err) => {
  console.error("[enricher] Fatal:", err);
  process.exit(1);
});
