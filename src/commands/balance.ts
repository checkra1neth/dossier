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
  walletNameOrAddress: string,
): Promise<BalanceReport> {
  let name: string;
  let address: string;

  if (walletNameOrAddress.startsWith("0x")) {
    // Direct address lookup (e.g. from XMTP sender)
    name = walletNameOrAddress.slice(0, 6) + "..." + walletNameOrAddress.slice(-4);
    address = walletNameOrAddress;
  } else {
    // OWS wallet name lookup
    const info = getWalletInfo(walletNameOrAddress);
    name = info.name;
    address = info.address;
  }

  const allPositions = await fetchPositions(address, "only_simple");
  // Filter out dust (< $0.01) and sort by value descending
  const positions = allPositions
    .filter((p) => p.valueUsd >= 0.01)
    .sort((a, b) => b.valueUsd - a.valueUsd);
  const totalUsd = positions.reduce((s, p) => s + p.valueUsd, 0);

  return {
    wallet: name,
    address,
    positions: positions.slice(0, 20),
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
