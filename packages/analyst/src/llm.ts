import { randomUUID } from "node:crypto";
import { envOptional } from "@wire/shared/config";
import type { EnrichedEvent, Signal } from "@wire/shared/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-4-scout:free";

function mockSignal(event: EnrichedEvent): Signal {
  const isSmartMoney = event.walletProfile.isSmartMoney;
  const actions: Signal["action"][] = ["BUY", "SELL", "WATCH"];
  const action = isSmartMoney ? "BUY" : actions[Math.floor(Math.random() * 3)];
  const confidence = isSmartMoney
    ? 75 + Math.floor(Math.random() * 21)
    : 30 + Math.floor(Math.random() * 41);

  return {
    id: randomUUID(),
    action,
    asset: event.walletProfile.topPositions[0]?.asset ?? "ETH",
    confidence,
    reasoning: isSmartMoney
      ? `Smart money wallet moved $${event.valueUsd.toLocaleString()} — historically profitable pattern`
      : `Whale transfer of $${event.valueUsd.toLocaleString()} detected, low-confidence signal`,
    basedOn: event.txHash,
  };
}

export async function analyzeEvent(event: EnrichedEvent): Promise<Signal> {
  const apiKey = envOptional("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.log("[analyst] No OPENROUTER_API_KEY, returning mock signal");
    return mockSignal(event);
  }

  try {
    const prompt = `You are a crypto trading analyst. Analyze this whale transaction and return a trading signal.

Transaction:
- Chain: ${event.chain}
- TX Hash: ${event.txHash}
- From: ${event.from}
- To: ${event.to}
- Value: $${event.valueUsd.toLocaleString()}
- Type: ${event.type}

Wallet Profile:
- Total Value: $${event.walletProfile.totalValueUsd.toLocaleString()}
- Top Positions: ${event.walletProfile.topPositions.map((p) => `${p.asset}: $${p.valueUsd.toLocaleString()}`).join(", ")}
- Transactions (30d): ${event.walletProfile.txCount30d}
- Smart Money: ${event.walletProfile.isSmartMoney}

Respond ONLY with valid JSON (no markdown, no code fences):
{"action": "BUY" | "SELL" | "WATCH", "asset": "<token symbol>", "confidence": <0-100>, "reasoning": "<one sentence>"}`;

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`[analyst] OpenRouter error: ${res.status} ${res.statusText}`);
      return mockSignal(event);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[analyst] Could not parse LLM response as JSON");
      return mockSignal(event);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      id: randomUUID(),
      action: parsed.action ?? "WATCH",
      asset: parsed.asset ?? "ETH",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 50,
      reasoning: parsed.reasoning ?? "LLM analysis",
      basedOn: event.txHash,
    };
  } catch (err) {
    console.error("[analyst] LLM call failed:", err);
    return mockSignal(event);
  }
}
