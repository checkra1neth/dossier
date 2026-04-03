import type { ZerionData, Analysis } from "./types.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3.6-plus:free";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

function buildPrompt(address: string, data: ZerionData): string {
  const positionsText = data.topPositions
    .map((p, i) => `${i + 1}. ${p.asset ?? "Unknown"}: $${(p.valueUsd ?? 0).toLocaleString("en-US")} (${p.percentage ?? 0}%)`)
    .join("\n");

  return `You are an expert on-chain intelligence analyst. Analyze this wallet and produce a comprehensive research report.

## Wallet: ${address}

**Portfolio:**
- Total Value: $${data.totalValueUsd.toLocaleString("en-US")}
- Active Chains: ${data.chains.join(", ") || "unknown"}
- Smart Money (>$5M): ${data.isSmartMoney ? "YES" : "NO"}
- Number of Positions: ${data.positionCount}

**Top Positions:**
${positionsText || "No positions found"}

## Your Task

Produce a deep analysis covering:
1. **Wallet Profile** — what kind of actor is this? (whale, DeFi farmer, trader, long-term holder, institution, etc.)
2. **Portfolio Strategy** — concentration vs diversification, chain preferences, DeFi vs spot holdings
3. **Risk Assessment** — how risky is this portfolio? exposure to volatile assets, single-asset concentration
4. **Notable Patterns** — anything unusual or interesting about the allocation
5. **Smart Money Verdict** — is this a sophisticated actor worth following?

Respond ONLY with valid JSON (no markdown fences, no commentary):
{
  "summary": "<comprehensive plain text report, NO markdown, use simple bullet points with •, at least 200 words>",
  "riskLevel": "low" | "medium" | "high",
  "patterns": ["<pattern 1>", "<pattern 2>", ...],
  "verdict": "<one sentence final verdict>"
}`;
}

export async function analyzeWallet(address: string, data: ZerionData): Promise<Analysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const prompt = buildPrompt(address, data);
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
        console.warn(`[llm] OpenRouter 429, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        lastError = new Error("OpenRouter rate limited (429)");
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      if (!res.ok) throw new Error(`OpenRouter ${res.status} ${res.statusText}`);

      const body = await res.json();
      const content: string = body.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse LLM response as JSON");

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary ?? "Analysis unavailable",
        riskLevel: ["low", "medium", "high"].includes(parsed.riskLevel) ? parsed.riskLevel : "medium",
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        verdict: parsed.verdict ?? "No verdict available",
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        console.error(`[llm] Attempt ${attempt + 1} failed: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  console.error(`[llm] All retries exhausted: ${lastError?.message}`);
  return fallbackAnalysis(data);
}

function fallbackAnalysis(data: ZerionData): Analysis {
  const topAsset = data.topPositions[0];
  const concentration = topAsset ? topAsset.percentage : 0;
  const riskLevel = concentration > 70 ? "high" : concentration > 40 ? "medium" : "low";

  return {
    summary: `## Basic Analysis\n\nPortfolio value: **$${data.totalValueUsd.toLocaleString("en-US")}** across ${data.chains.length} chains.\n\n${data.isSmartMoney ? "**Smart Money wallet** (>$5M)." : "Standard wallet."}\n\nTop holding: ${topAsset?.asset ?? "N/A"} at ${concentration}%.\n\n*LLM analysis was unavailable. This is a basic data summary.*`,
    riskLevel,
    patterns: data.isSmartMoney ? ["High-value wallet"] : ["Standard wallet"],
    verdict: data.isSmartMoney
      ? "High-value wallet — LLM analysis unavailable for deeper insight"
      : "Standard wallet — LLM analysis unavailable for deeper insight",
  };
}
