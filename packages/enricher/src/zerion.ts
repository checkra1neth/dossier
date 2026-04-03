import { envOptional } from "@wire/shared/config";

interface WalletProfile {
  totalValueUsd: number;
  topPositions: { asset: string; valueUsd: number }[];
  txCount30d: number;
  isSmartMoney: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

const profileCache = new Map<string, { profile: WalletProfile; timestamp: number }>();

function getCached(address: string): WalletProfile | null {
  const entry = profileCache.get(address.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    profileCache.delete(address.toLowerCase());
    return null;
  }
  return entry.profile;
}

function setCache(address: string, profile: WalletProfile): void {
  profileCache.set(address.toLowerCase(), { profile, timestamp: Date.now() });
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });

    if (res.ok) return res;

    if (res.status === 429) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[enricher] Zerion 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      lastError = new Error(`Zerion API rate limited (429)`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Zerion API ${res.status} ${res.statusText}`);
  }

  throw lastError ?? new Error("Zerion API failed after retries");
}

export async function getWalletProfile(address: string): Promise<WalletProfile> {
  // Check cache first
  const cached = getCached(address);
  if (cached) {
    console.log(`[enricher] Cache hit for ${address.slice(0, 10)}...`);
    return cached;
  }

  const apiKey = envOptional("ZERION_API_KEY");
  if (!apiKey) {
    throw new Error("ZERION_API_KEY is not set");
  }

  const headers = {
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    Accept: "application/json",
  };

  const [portfolioRes, positionsRes] = await Promise.all([
    fetchWithRetry(`https://api.zerion.io/v1/wallets/${address}/portfolio?currency=usd`, headers),
    fetchWithRetry(
      `https://api.zerion.io/v1/wallets/${address}/positions/?filter[positions]=no_filter&currency=usd&page[size]=5&sort=-value`,
      headers,
    ),
  ]);

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

  const profile: WalletProfile = { totalValueUsd, topPositions, txCount30d, isSmartMoney };
  setCache(address, profile);
  return profile;
}
