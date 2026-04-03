import { fetchPnl } from "../services/zerion.ts";
import type { PnlReport } from "../types.ts";

function usd(v: number): string {
  const abs = Math.abs(v);
  const formatted =
    abs >= 1000
      ? `$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `$${abs.toFixed(2)}`;
  return v < 0 ? `-${formatted}` : formatted;
}

function signed(v: number): string {
  const prefix = v >= 0 ? "+" : "";
  return `${prefix}${usd(v)}`;
}

export async function handlePnl(address: string): Promise<PnlReport> {
  const pnl = await fetchPnl(address);

  const totalGain = pnl.realizedGain + pnl.unrealizedGain;
  const roi = pnl.netInvested !== 0 ? (totalGain / pnl.netInvested) * 100 : 0;

  return { address, pnl, roi };
}

export function pnlToText(report: PnlReport): string {
  const { address, pnl, roi } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const signedRoi = roi >= 0 ? `+${roi.toFixed(1)}%` : `${roi.toFixed(1)}%`;
  const arrow = roi >= 0 ? "▲" : "▼";

  return [
    `📈 PnL: ${short}`,
    `💵 Net invested: ${usd(pnl.netInvested)}`,
    `✅ Realized: ${signed(pnl.realizedGain)}`,
    `⏳ Unrealized: ${signed(pnl.unrealizedGain)}`,
    `💸 Fees paid: ${usd(pnl.totalFees)}`,
    `${arrow} ROI: ${signedRoi}`,
  ].join("\n");
}
