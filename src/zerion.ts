import type { ZerionData } from "./types.ts";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

const cache = new Map<string, { data: ZerionData; timestamp: number }>();

function getCached(address: string): ZerionData | null {
  const entry = cache.get(address.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(address.toLowerCase());
    return null;
  }
  return entry.data;
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });

    if (res.ok) return res;

    if (res.status === 429) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[zerion] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      lastError = new Error("Zerion API rate limited (429)");
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Zerion API ${res.status} ${res.statusText}`);
  }

  throw lastError ?? new Error("Zerion API failed after retries");
}

export async function fetchWalletData(address: string): Promise<ZerionData> {
  const cached = getCached(address);
  if (cached) {
    console.log(`[zerion] Cache hit for ${address.slice(0, 10)}...`);
    return cached;
  }

  const apiKey = process.env.ZERION_API_KEY;
  if (!apiKey) throw new Error("ZERION_API_KEY is not set");

  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    Accept: "application/json",
  };

  const [portfolioRes, positionsRes] = await Promise.all([
    fetchWithRetry(`https://api.zerion.io/v1/wallets/${address}/portfolio?currency=usd`, headers),
    fetchWithRetry(
      `https://api.zerion.io/v1/wallets/${address}/positions/?filter[positions]=only_simple&filter[trash]=only_non_trash&currency=usd&page[size]=100&sort=-value`,
      headers,
    ),
  ]);

  const portfolio = (await portfolioRes.json()) as {
    data: { attributes: { total: { positions: number }; positions_distribution_by_chain: Record<string, number> } };
  };
  const positions = (await positionsRes.json()) as {
    data: {
      attributes: {
        fungible_info: { name: string; symbol: string };
        value: number | null;
        quantity: { float: number };
      };
      relationships: { chain: { data: { id: string } } };
    }[];
  };

  const totalValueUsd = portfolio.data.attributes.total.positions;
  const chains = Object.keys(portfolio.data.attributes.positions_distribution_by_chain ?? {});

  const topPositions = positions.data
    .filter((p) => p.attributes.value != null && p.attributes.value > 1)
    .sort((a, b) => (b.attributes.value ?? 0) - (a.attributes.value ?? 0))
    .slice(0, 10)
    .map((p) => ({
      asset: p.attributes.fungible_info.symbol,
      valueUsd: p.attributes.value!,
      percentage: totalValueUsd > 0 ? Math.round((p.attributes.value! / totalValueUsd) * 1000) / 10 : 0,
    }));

  const result: ZerionData = {
    totalValueUsd,
    chains,
    topPositions,
    isSmartMoney: totalValueUsd > 5_000_000,
    positionCount: positions.data.length,
  };

  cache.set(address.toLowerCase(), { data: result, timestamp: Date.now() });
  return result;
}
