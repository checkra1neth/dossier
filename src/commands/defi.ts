import { fetchDefiPositions } from "../services/zerion.ts";
import type { DefiReport } from "../types.ts";

function usd(v: number): string {
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

export async function handleDefi(address: string): Promise<DefiReport> {
  const positions = await fetchDefiPositions(address);
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

  for (const [protocol, poses] of byProtocol) {
    const protocolTotal = poses.reduce((s, p) => s + p.valueUsd, 0);
    lines.push(`▸ ${protocol} (${usd(protocolTotal)})`);
    for (const p of poses) {
      lines.push(`  ${p.type}: ${p.asset} — ${usd(p.valueUsd)} [${p.chain}]`);
    }
  }

  return lines.join("\n");
}
