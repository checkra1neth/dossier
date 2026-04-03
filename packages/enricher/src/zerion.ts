import { envOptional } from "@wire/shared/config";

interface WalletProfile {
  totalValueUsd: number;
  topPositions: { asset: string; valueUsd: number }[];
  txCount30d: number;
  isSmartMoney: boolean;
}

function mockProfile(address: string): WalletProfile {
  const seed = parseInt(address.slice(2, 10), 16);
  const totalValueUsd = 100_000 + (seed % 49_900_000);

  const mockAssets = ["ETH", "USDC", "WBTC", "AAVE", "UNI"];
  const topPositions = mockAssets.map((asset, i) => ({
    asset,
    valueUsd: Math.round(totalValueUsd * (0.4 - i * 0.07) * 100) / 100,
  }));

  const txCount30d = 10 + (seed % 500);
  const isSmartMoney = totalValueUsd > 5_000_000;

  return { totalValueUsd, topPositions, txCount30d, isSmartMoney };
}

export async function getWalletProfile(address: string): Promise<WalletProfile> {
  const apiKey = envOptional("ZERION_API_KEY");
  if (!apiKey) {
    console.log(`[enricher] No ZERION_API_KEY — using mock profile for ${address.slice(0, 10)}...`);
    return mockProfile(address);
  }

  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    Accept: "application/json",
  };

  try {
    const [portfolioRes, positionsRes] = await Promise.all([
      fetch(`https://api.zerion.io/v1/wallets/${address}/portfolio?currency=usd`, { headers }),
      fetch(
        `https://api.zerion.io/v1/wallets/${address}/positions/?filter[positions]=no_filter&currency=usd&page[size]=5&sort=-value`,
        { headers },
      ),
    ]);

    if (!portfolioRes.ok || !positionsRes.ok) {
      console.warn(`[enricher] Zerion API error (${portfolioRes.status}/${positionsRes.status}), falling back to mock`);
      return mockProfile(address);
    }

    const portfolio = (await portfolioRes.json()) as {
      data: { attributes: { total: { positions: number } } };
    };
    const positions = (await positionsRes.json()) as {
      data: { attributes: { name: string; value: number } }[];
    };

    const totalValueUsd = portfolio.data.attributes.total.positions;

    const topPositions = positions.data.map((p) => ({
      asset: p.attributes.name,
      valueUsd: p.attributes.value,
    }));

    // Estimate tx count — Zerion doesn't expose this directly, use portfolio size as proxy
    const txCount30d = Math.min(topPositions.length * 30, 999);
    const isSmartMoney = totalValueUsd > 5_000_000;

    return { totalValueUsd, topPositions, txCount30d, isSmartMoney };
  } catch (err) {
    console.error("[enricher] Zerion fetch failed:", err);
    return mockProfile(address);
  }
}
