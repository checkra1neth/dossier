import express from "express";
import { PORTS } from "@wire/shared/config";
import { sseHandler, broadcastSSE } from "@wire/shared/sse";
import {
  createWireAgent,
  sendToGroup,
  makeWireMessage,
  onWireMessage,
  wireMessageHandler,
} from "@wire/shared/xmtp";
import type { EnrichedEvent } from "@wire/shared/types";
import { analyzeEvent } from "./llm.ts";
import { addSignal, getLatestSignal, getSignals } from "./signals-store.ts";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
app.use(express.json({ limit: "5mb" }));

// SSE + health endpoints
app.get("/events", sseHandler);
app.get("/health", (_req, res) => res.json({ status: "ok", agent: "analyst" }));

const wireAgent = await createWireAgent("analyst");

app.get("/address", (_req, res) => res.json({ address: wireAgent.address }));
app.post("/group", (req, res) => {
  const { groupId } = req.body as { groupId: string };
  if (!groupId) {
    res.status(400).json({ error: "groupId required" });
    return;
  }
  wireAgent.groupId = groupId;
  console.log(`[analyst] Joined group: ${groupId}`);
  res.json({ ok: true, groupId });
});

// Wire message endpoint (receive messages from other agents)
app.post("/wire-message", express.json({ limit: "5mb" }), wireMessageHandler(wireAgent));

// x402 paid API endpoints
const paidRouter = express.Router();

try {
  const facilitatorUrl =
    process.env.FACILITATOR_URL || "https://x402.org/facilitator";
  const payTo = wireAgent.address;

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient);

  const network = "eip155:84532";
  resourceServer.register(network, new ExactEvmScheme());

  const routes = {
    "GET /api/signals": {
      accepts: [{ scheme: "exact", price: "$0.01", network, payTo }],
      description: "Latest intelligence signals",
      mimeType: "application/json",
    },
    "GET /api/signals/latest": {
      accepts: [{ scheme: "exact", price: "$0.005", network, payTo }],
      description: "Single latest signal",
      mimeType: "application/json",
    },
    "GET /api/history": {
      accepts: [{ scheme: "exact", price: "$0.05", network, payTo }],
      description: "24h signal history",
      mimeType: "application/json",
    },
  };

  const middleware = paymentMiddleware(routes, resourceServer);

  paidRouter.get("/signals", (_req: express.Request, res: express.Response) => {
    res.json(getSignals(50));
  });

  paidRouter.get("/signals/latest", (_req: express.Request, res: express.Response) => {
    res.json(getLatestSignal());
  });

  paidRouter.get("/history", (_req: express.Request, res: express.Response) => {
    res.json(getSignals(200));
  });

  app.use(middleware);
  console.log("[analyst] x402 payment middleware loaded");
} catch (err) {
  console.warn("[analyst] x402 packages not available, serving API without payment gate:", (err as Error).message);

  paidRouter.get("/signals", (_req, res) => res.json(getSignals(50)));
  paidRouter.get("/signals/latest", (_req, res) => res.json(getLatestSignal()));
  paidRouter.get("/history", (_req, res) => res.json(getSignals(200)));
}

app.use("/api", paidRouter);

// Listen for wire messages
onWireMessage(wireAgent, async (wireMsg) => {
  if (wireMsg.type !== "enriched_event") return;

  const enrichedEvent = wireMsg.data as EnrichedEvent;
  console.log(`[analyst] Received enriched event: ${enrichedEvent.txHash}`);

  const signal = await analyzeEvent(enrichedEvent);
  addSignal(signal);
  console.log(`[analyst] Signal: ${signal.action} ${signal.asset} (${signal.confidence}%)`);

  const outMsg = makeWireMessage("analyst", "signal", signal);
  broadcastSSE("analyst", outMsg);

  try {
    await sendToGroup(wireAgent, outMsg);
  } catch (err) {
    console.warn("[analyst] Could not send to group:", (err as Error).message);
  }
});

const port = PORTS.analyst;
app.listen(port, () => {
  console.log(`[analyst] HTTP server on :${port}`);
  console.log(`[analyst] SSE at /events, API at /api/signals`);
});

console.log("[analyst] Wire message listener active");
