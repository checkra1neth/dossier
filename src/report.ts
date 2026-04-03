import type { ZerionData, Analysis, ResearchReport } from "./types.ts";

function usd(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildReport(address: string, data: ZerionData, analysis: Analysis): ResearchReport {
  return {
    address,
    timestamp: Date.now(),
    data,
    analysis,
  };
}

export function reportToMarkdown(report: ResearchReport): string {
  const { address, data, analysis } = report;
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const header =
    `📊 RESEARCH REPORT: ${shortAddr}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 Total Value: $${usd(data.totalValueUsd)}\n` +
    `🔗 Chains: ${data.chains.length}\n` +
    `🧠 Smart Money: ${data.isSmartMoney ? "YES" : "NO"}\n` +
    `⚠️ Risk: ${analysis.riskLevel.toUpperCase()}\n`;

  const positions = data.topPositions.length > 0
    ? `\n🏦 TOP POSITIONS\n` +
      data.topPositions.map((p) => `  ${p.asset}: $${usd(p.valueUsd)} (${p.percentage}%)`).join("\n") +
      "\n"
    : "";

  // Strip markdown from LLM summary
  const cleanSummary = analysis.summary
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^- /gm, "• ")
    .trim();

  return header + positions + `\n📝 ANALYSIS\n${cleanSummary}\n\n🏁 VERDICT: ${analysis.verdict}\n\n— Dossier`;
}
