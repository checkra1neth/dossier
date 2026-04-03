import { fetchTransactions } from "../services/zerion.ts";
import type { HistoryReport } from "../types.ts";

function usd(v: number): string {
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function classifyFrequency(transactions: { timestamp: string }[]): string {
  if (transactions.length < 2) return "insufficient data";

  const timestamps = transactions
    .map((t) => new Date(t.timestamp).getTime())
    .sort((a, b) => b - a);

  const gaps: number[] = [];
  for (let i = 0; i < timestamps.length - 1; i++) {
    gaps.push(timestamps[i] - timestamps[i + 1]);
  }

  const avgGapHours = gaps.reduce((s, g) => s + g, 0) / gaps.length / 3_600_000;

  if (avgGapHours < 1) return "very active (multiple/hour)";
  if (avgGapHours < 6) return "active (several/day)";
  if (avgGapHours < 24) return "moderate (daily)";
  if (avgGapHours < 168) return "casual (weekly)";
  return "inactive (rare)";
}

export async function handleHistory(address: string): Promise<HistoryReport> {
  const transactions = await fetchTransactions(address, 20);

  const pattern = { trades: 0, receives: 0, sends: 0, executes: 0, other: 0 };
  for (const tx of transactions) {
    const t = tx.type.toLowerCase();
    if (t === "trade" || t === "swap") pattern.trades++;
    else if (t === "receive") pattern.receives++;
    else if (t === "send") pattern.sends++;
    else if (t === "execute" || t === "approve") pattern.executes++;
    else pattern.other++;
  }

  const frequency = classifyFrequency(transactions);

  return { address, transactions, pattern, frequency };
}

export function historyToText(report: HistoryReport): string {
  const { address, transactions, pattern, frequency } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const lines: string[] = [
    `📜 History: ${short}`,
    `⏱ Frequency: ${frequency}`,
    `🔄 Pattern: ${pattern.trades} trades, ${pattern.receives} receives, ${pattern.sends} sends, ${pattern.executes} executes, ${pattern.other} other`,
    "",
    "Recent transactions:",
  ];

  const shown = transactions.slice(0, 8);
  for (const tx of shown) {
    const ago = timeAgo(tx.timestamp);
    const mainTransfer = tx.transfers[0];
    const detail = mainTransfer
      ? `${mainTransfer.symbol} ${usd(mainTransfer.valueUsd)}`
      : "";
    lines.push(`  ${tx.type} ${detail} [${tx.chain}] — ${ago}`);
  }

  if (transactions.length > 8) {
    lines.push(`  ... and ${transactions.length - 8} more`);
  }

  return lines.join("\n");
}
