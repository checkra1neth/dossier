import { fetchDefiPositions } from "../services/zerion.ts";
import type { DefiReport } from "../types.ts";

function usd(v: number): string {
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

export async function handleDefi(address: string): Promise<DefiReport> {
  const allPositions = await fetchDefiPositions(address);
  // Filter out dust and zero-value positions
  const positions = allPositions.filter((p) => p.valueUsd > 0.15);
  const totalDefiUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);

  return { address, positions, totalDefiUsd };
}

export function defiToText(report: DefiReport): string {
  const { address, positions, totalDefiUsd } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (positions.length === 0) {
    return `🏗 DeFi: ${short}\nNo active DeFi positions found.`;
  }

  // Group by protocol
  const byProtocol = new Map<string, typeof positions>();
  for (const pos of positions) {
    const existing = byProtocol.get(pos.protocol) ?? [];
    existing.push(pos);
    byProtocol.set(pos.protocol, existing);
  }

  const lines: string[] = [
    `🏗 DeFi: ${short}`,
    `💰 Total DeFi: ${usd(totalDefiUsd)}`,
    `📋 ${positions.length} position(s) across ${byProtocol.size} protocol(s)`,
    "",
  ];

  // Sort protocols by total value descending
  const sorted = [...byProtocol.entries()]
    .map(([protocol, poses]) => ({ protocol, poses, total: poses.reduce((s, p) => s + p.valueUsd, 0) }))
    .sort((a, b) => b.total - a.total);

  for (const { protocol, poses, total } of sorted) {
    lines.push(`▸ ${protocol} (${usd(total)})`);
    // Sort positions within protocol by value descending
    const sortedPoses = [...poses].sort((a, b) => b.valueUsd - a.valueUsd);
    for (const p of sortedPoses) {
      lines.push(`  ${p.type}: ${p.asset} — ${usd(p.valueUsd)} [${p.chain}]`);
    }
  }

  return lines.join("\n");
}
