import { randomUUID } from "node:crypto";
import { envOptional } from "@wire/shared/config";
import type { EnrichedEvent, Signal } from "@wire/shared/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3.6-plus:free";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export async function analyzeEvent(event: EnrichedEvent): Promise<Signal> {
  const apiKey = envOptional("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
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

      if (res.status === 429) {
        console.warn(`[analyst] OpenRouter 429, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        lastError = new Error("OpenRouter rate limited (429)");
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      if (!res.ok) {
        throw new Error(`OpenRouter error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const content: string = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse LLM response as JSON");
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
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        console.error(`[analyst] LLM call failed (attempt ${attempt + 1}): ${lastError.message}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  // All retries exhausted — return minimal fallback signal
  console.error(`[analyst] LLM unavailable after ${MAX_RETRIES} retries: ${lastError?.message}`);
  return {
    id: randomUUID(),
    action: "WATCH",
    asset: "ETH",
    confidence: 0,
    reasoning: "LLM temporarily unavailable",
    basedOn: event.txHash,
  };
}
