import { fetchPortfolio, fetchPositions } from "../services/zerion.ts";
import type { QuickReport } from "../types.ts";

function usd(v: number): string {
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

export async function handleQuick(address: string): Promise<QuickReport> {
  const [portfolio, positions] = await Promise.all([
    fetchPortfolio(address),
    fetchPositions(address),
  ]);

  const topPositions = positions.slice(0, 3);

  return { address, portfolio, topPositions };
}

export function quickToText(report: QuickReport): string {
  const { address, portfolio, topPositions } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const sign = portfolio.change24hPercent >= 0 ? "+" : "";
  const changeStr = `${sign}${portfolio.change24hPercent.toFixed(1)}%`;
  const arrow = portfolio.change24hPercent >= 0 ? "▲" : "▼";

  const chainsShown = portfolio.chains.slice(0, 3).join(", ");
  const chainsExtra =
    portfolio.chains.length > 3
      ? ` (+${portfolio.chains.length - 3} more)`
      : "";

  const topStr = topPositions
    .map((p) => `${p.asset} ${usd(p.valueUsd)}`)
    .join(", ");

  return [
    `📊 Quick: ${short}`,
    `💰 ${usd(portfolio.totalValueUsd)} (${arrow} ${changeStr} 24h)`,
    `🔗 Chains: ${chainsShown}${chainsExtra}`,
    `🏦 Top: ${topStr}`,
  ].join("\n");
}
