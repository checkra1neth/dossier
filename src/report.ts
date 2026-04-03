import type { ZerionData, Analysis, ResearchReport } from "./types.ts";

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

  const header = `# Research Report: ${shortAddr}\n\n` +
    `**Total Value:** $${data.totalValueUsd.toLocaleString()} | ` +
    `**Chains:** ${data.chains.join(", ") || "unknown"} | ` +
    `**Smart Money:** ${data.isSmartMoney ? "YES ✅" : "NO"} | ` +
    `**Risk:** ${analysis.riskLevel.toUpperCase()}\n\n`;

  const positions = data.topPositions.length > 0
    ? "## Top Positions\n\n" +
      data.topPositions.map((p) => `- **${p.asset}**: $${p.valueUsd.toLocaleString()} (${p.percentage}%)`).join("\n") +
      "\n\n"
    : "";

  return header + positions + analysis.summary + "\n\n---\n*Powered by OWS Deep Research Service*";
}
