import express from "express";
import type { RawEvent, EnrichedEvent } from "@wire/shared/types";
import { PORTS } from "@wire/shared/config";
import { sseHandler, broadcastSSE } from "@wire/shared/sse";
import {
  createWireAgent,
  sendToGroup,
  makeWireMessage,
  onWireMessage,
  wireMessageHandler,
} from "@wire/shared/xmtp";
import { getWalletProfile } from "./zerion.ts";

const app = express();
app.use(express.json());

app.get("/events", sseHandler);
app.get("/health", (_req, res) => {
  res.json({ agent: "enricher", status: "ok", uptime: process.uptime() });
});

let wireAgent: Awaited<ReturnType<typeof createWireAgent>> | null = null;

app.get("/address", (_req, res) => {
  res.json({ address: wireAgent?.address ?? null });
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

async function handleRawEvent(raw: RawEvent): Promise<void> {
  console.log(`[enricher] Enriching tx ${raw.txHash.slice(0, 10)}... from ${raw.from.slice(0, 10)}...`);

  let walletProfile: EnrichedEvent["walletProfile"];
  try {
    walletProfile = await getWalletProfile(raw.from);
  } catch (err) {
    console.error(`[enricher] Zerion failed for ${raw.from.slice(0, 10)}...: ${err instanceof Error ? err.message : err}`);
    console.log(`[enricher] Forwarding event with minimal wallet profile`);
    walletProfile = {
      totalValueUsd: 0,
      isSmartMoney: false,
      topPositions: [],
      txCount30d: 0,
    };
  }

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

  // Wire message endpoint (receive messages from other agents)
  app.post("/wire-message", express.json(), wireMessageHandler(wireAgent));

  // Listen for wire messages
  onWireMessage(wireAgent, async (wire) => {
    if (wire.type === "raw_event") {
      const rawEvent = wire.data as RawEvent;
      await handleRawEvent(rawEvent);
    }
  });

  console.log("[enricher] Listening for wire messages");

  const port = PORTS.enricher;
  app.listen(port, () => {
    console.log(`[enricher] HTTP server on :${port}`);
  });
}

main().catch((err) => {
  console.error("[enricher] Fatal:", err);
  process.exit(1);
});
