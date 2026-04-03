import type { ResearchReport } from "./types.ts";
import { fetchWalletData } from "./zerion.ts";
import {
  fetchDefiPositions,
  fetchPnl,
  fetchTransactions,
} from "./services/zerion.ts";
import { analyzeWallet } from "./llm.ts";
import { buildReport } from "./report.ts";

export async function research(address: string): Promise<ResearchReport> {
  console.log(`[pipeline] Starting research for ${address.slice(0, 10)}...`);

  const [data, defiPositions, pnl, transactions] = await Promise.all([
    fetchWalletData(address),
    fetchDefiPositions(address).catch(() => []),
    fetchPnl(address).catch(() => null),
    fetchTransactions(address, 20).catch(() => []),
  ]);

  console.log(
    `[pipeline] Zerion data fetched: $${data.totalValueUsd.toLocaleString()}, ${data.positionCount} positions` +
      `, ${defiPositions.length} DeFi positions, pnl=${pnl ? "yes" : "no"}, ${transactions.length} txns`,
  );

  const analysis = await analyzeWallet(address, data, defiPositions, pnl, transactions);
  console.log(`[pipeline] LLM analysis complete: risk=${analysis.riskLevel}, ${analysis.patterns.length} patterns`);

  return buildReport(address, data, analysis);
}
