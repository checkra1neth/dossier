import { getWalletInfo } from "../services/ows.ts";
import { fetchPositions } from "../services/zerion.ts";
import type { Position } from "../types.ts";

export interface BalanceReport {
  wallet: string;
  address: string;
  positions: Position[];
  totalUsd: number;
}

export async function handleBalance(
  walletName: string,
): Promise<BalanceReport> {
  const info = getWalletInfo(walletName);
  const positions = await fetchPositions(info.address, "only_simple");
  const totalUsd = positions.reduce((s, p) => s + p.valueUsd, 0);

  return {
    wallet: info.name,
    address: info.address,
    positions: positions.slice(0, 10),
    totalUsd,
  };
}

export function balanceToText(report: BalanceReport): string {
  const { wallet, address, positions, totalUsd } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  let text = `\u{1F4B0} Wallet: ${wallet} (${short})\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;

  if (positions.length === 0) {
    text += "No positions found.\n";
  } else {
    for (const p of positions) {
      const value = p.valueUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      text += `  ${p.asset}: $${value} (${p.chain})\n`;
    }
  }

  const totalStr = totalUsd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  text += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nTotal: $${totalStr}`;

  return text;
}
