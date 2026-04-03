import { fetchPortfolio, fetchPositions, fetchPnl } from "../services/zerion.ts";
import type { CompareReport, PnlData } from "../types.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3.6-plus:free";

function usd(v: number): string {
  const abs = Math.abs(v);
  const formatted =
    abs >= 1000
      ? `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `$${abs.toFixed(2)}`;
  return v < 0 ? `-${formatted}` : formatted;
}

function roi(pnl: PnlData): number {
  const totalGain = pnl.realizedGain + pnl.unrealizedGain;
  return pnl.netInvested !== 0 ? (totalGain / pnl.netInvested) * 100 : 0;
}

function shortAddr(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function pad(text: string, width: number): string {
  return text.padStart(width);
}

async function generateVerdict(report: CompareReport): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallbackVerdict(report);

  const roiA = roi(report.a.pnl);
  const roiB = roi(report.b.pnl);
  const topA = report.a.positions[0]?.asset ?? "N/A";
  const topB = report.b.positions[0]?.asset ?? "N/A";

  const prompt = `You are an on-chain analyst. Compare these two wallets in 2-3 sentences. Be specific and concise.

Wallet A (${shortAddr(report.addressA)}):
- Total: ${usd(report.a.portfolio.totalValueUsd)}
- Chains: ${report.a.portfolio.chains.length}
- ROI: ${roiA >= 0 ? "+" : ""}${roiA.toFixed(1)}%
- Top asset: ${topA}
- Smart Money: ${report.a.portfolio.totalValueUsd > 5_000_000 ? "YES" : "NO"}

Wallet B (${shortAddr(report.addressB)}):
- Total: ${usd(report.b.portfolio.totalValueUsd)}
- Chains: ${report.b.portfolio.chains.length}
- ROI: ${roiB >= 0 ? "+" : ""}${roiB.toFixed(1)}%
- Top asset: ${topB}
- Smart Money: ${report.b.portfolio.totalValueUsd > 5_000_000 ? "YES" : "NO"}

Respond with ONLY the comparison text, no JSON, no markdown.`;

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

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);

    const body = await res.json();
    const content: string = body.choices?.[0]?.message?.content ?? "";
    if (content.trim().length > 0) return content.trim();

    return fallbackVerdict(report);
  } catch (err) {
    console.error(`[compare] LLM verdict failed: ${err instanceof Error ? err.message : String(err)}`);
    return fallbackVerdict(report);
  }
}

function fallbackVerdict(report: CompareReport): string {
  const valA = report.a.portfolio.totalValueUsd;
  const valB = report.b.portfolio.totalValueUsd;
  const roiA = roi(report.a.pnl);
  const roiB = roi(report.b.pnl);

  const richer = valA > valB ? "A" : "B";
  const better = roiA > roiB ? "A" : "B";

  if (richer === better) {
    return `Wallet ${richer} dominates with both higher portfolio value and better ROI. Wallet ${richer === "A" ? "B" : "A"} trails significantly across key metrics.`;
  }
  return `Wallet ${richer} holds more capital, but Wallet ${better} delivers better returns. Different strategies — size vs efficiency.`;
}

export async function handleCompare(addrA: string, addrB: string): Promise<CompareReport> {
  const [portfolioA, positionsA, pnlA, portfolioB, positionsB, pnlB] =
    await Promise.all([
      fetchPortfolio(addrA),
      fetchPositions(addrA),
      fetchPnl(addrA),
      fetchPortfolio(addrB),
      fetchPositions(addrB),
      fetchPnl(addrB),
    ]);

  const report: CompareReport = {
    addressA: addrA,
    addressB: addrB,
    a: { portfolio: portfolioA, positions: positionsA.slice(0, 10), pnl: pnlA },
    b: { portfolio: portfolioB, positions: positionsB.slice(0, 10), pnl: pnlB },
    verdict: "",
  };

  report.verdict = await generateVerdict(report);

  return report;
}

export function compareToText(report: CompareReport): string {
  const shortA = shortAddr(report.addressA);
  const shortB = shortAddr(report.addressB);

  const roiA = roi(report.a.pnl);
  const roiB = roi(report.b.pnl);
  const roiStrA = `${roiA >= 0 ? "+" : ""}${roiA.toFixed(1)}%`;
  const roiStrB = `${roiB >= 0 ? "+" : ""}${roiB.toFixed(1)}%`;

  const smartA = report.a.portfolio.totalValueUsd > 5_000_000 ? "YES" : "NO";
  const smartB = report.b.portfolio.totalValueUsd > 5_000_000 ? "YES" : "NO";

  const topA = report.a.positions[0]?.asset ?? "N/A";
  const topB = report.b.positions[0]?.asset ?? "N/A";

  const col = 16;
  const label = 15;

  const lines = [
    `\u2694\uFE0F Compare: ${shortA} vs ${shortB}`,
    "\u2501".repeat(35),
    `${"".padEnd(label)}${pad("Wallet A", col)}${pad("Wallet B", col)}`,
    `${"Total Value".padEnd(label)}${pad(usd(report.a.portfolio.totalValueUsd), col)}${pad(usd(report.b.portfolio.totalValueUsd), col)}`,
    `${"Chains".padEnd(label)}${pad(String(report.a.portfolio.chains.length), col)}${pad(String(report.b.portfolio.chains.length), col)}`,
    `${"Smart Money".padEnd(label)}${pad(smartA, col)}${pad(smartB, col)}`,
    `${"ROI".padEnd(label)}${pad(roiStrA, col)}${pad(roiStrB, col)}`,
    `${"Top Asset".padEnd(label)}${pad(topA, col)}${pad(topB, col)}`,
    "",
    `\uD83C\uDFC1 ${report.verdict}`,
  ];

  return lines.join("\n");
}
