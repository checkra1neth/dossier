import type { ResearchReport, ZerionData } from "./types.ts";
import {
  fetchPortfolio,
  fetchPositions,
  fetchDefiPositions,
  fetchPnl,
  fetchTransactions,
} from "./services/zerion.ts";
import { analyzeWallet } from "./llm.ts";
import { buildReport } from "./report.ts";

export async function research(address: string): Promise<ResearchReport> {
  console.log(`[pipeline] Starting research for ${address.slice(0, 10)}...`);

  const [portfolio, positions, defiPositions, pnl, transactions] = await Promise.all([
    fetchPortfolio(address),
    fetchPositions(address),
    fetchDefiPositions(address).catch(() => []),
    fetchPnl(address).catch(() => null),
    fetchTransactions(address, 20).catch(() => []),
  ]);

  const topPositions = positions.slice(0, 10).map((p) => ({
    asset: p.asset,
    valueUsd: p.valueUsd,
    percentage: p.percentage,
  }));

  const data: ZerionData = {
    totalValueUsd: portfolio.totalValueUsd,
    chains: portfolio.chains,
    topPositions,
    isSmartMoney: portfolio.totalValueUsd > 5_000_000,
    positionCount: positions.length,
  };

  console.log(
    `[pipeline] Zerion data fetched: $${data.totalValueUsd.toLocaleString()}, ${data.positionCount} positions` +
      `, ${defiPositions.length} DeFi positions, pnl=${pnl ? "yes" : "no"}, ${transactions.length} txns`,
  );

  const analysis = await analyzeWallet(address, data, defiPositions, pnl, transactions);
  console.log(`[pipeline] LLM analysis complete: risk=${analysis.riskLevel}, ${analysis.patterns.length} patterns`);

  return buildReport(address, data, analysis);
}
