import { fetchNftCollections, fetchNftPositions } from "../services/zerion.ts";
import type { NftReport } from "../types.ts";

function usd(v: number): string {
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

export async function handleNft(address: string): Promise<NftReport> {
  const [collections, positions] = await Promise.all([
    fetchNftCollections(address),
    fetchNftPositions(address),
  ]);
  const totalEstimatedUsd = collections.reduce(
    (sum, c) => sum + c.floorPrice,
    0,
  );

  return { address, collections, positions, totalEstimatedUsd };
}

export function nftToText(report: NftReport): string {
  const { address, collections, totalEstimatedUsd } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (collections.length === 0) {
    return `🖼 NFTs: ${short}\nNo NFT collections found.`;
  }

  const lines: string[] = [
    `🖼 NFTs: ${short}`,
    `💰 Estimated total: ${usd(totalEstimatedUsd)}`,
    `📋 ${collections.length} collection(s)`,
    "",
  ];

  const top = collections.slice(0, 5);
  for (const c of top) {
    const floor = c.floorPrice > 0 ? usd(c.floorPrice) : "n/a";
    lines.push(`  ${c.name} — ${c.count} NFT(s), floor: ${floor} [${c.chain}]`);
  }

  if (collections.length > 5) {
    lines.push(`  ... and ${collections.length - 5} more`);
  }

  return lines.join("\n");
}
