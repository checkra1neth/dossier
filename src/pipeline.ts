import type { ResearchReport } from "./types.ts";
import { fetchWalletData } from "./zerion.ts";
import { analyzeWallet } from "./llm.ts";
import { buildReport } from "./report.ts";

export async function research(address: string): Promise<ResearchReport> {
  console.log(`[pipeline] Starting research for ${address.slice(0, 10)}...`);

  const data = await fetchWalletData(address);
  console.log(`[pipeline] Zerion data fetched: $${data.totalValueUsd.toLocaleString()}, ${data.positionCount} positions`);

  const analysis = await analyzeWallet(address, data);
  console.log(`[pipeline] LLM analysis complete: risk=${analysis.riskLevel}, ${analysis.patterns.length} patterns`);

  return buildReport(address, data, analysis);
}
