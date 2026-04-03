/**
 * Comprehensive Zerion API client for OWS Intelligence Wire.
 *
 * Covers: portfolio, positions (simple + DeFi), PnL, transactions, NFT collections.
 * Includes per-URL caching (5 min TTL) and retry with exponential backoff on 429.
 */

const BASE_URL = "https://api.zerion.io/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface PortfolioData {
  totalValueUsd: number;
  chains: string[];
  change24hPercent: number;
  change24hUsd: number;
}

export interface Position {
  asset: string;
  name: string;
  valueUsd: number;
  quantity: number;
  chain: string;
  percentage: number;
}

export interface DefiPosition {
  protocol: string;
  type: "deposited" | "staked" | "locked" | "reward";
  asset: string;
  valueUsd: number;
  chain: string;
}

export interface PnlData {
  realizedGain: number;
  unrealizedGain: number;
  totalFees: number;
  netInvested: number;
}

export interface Transaction {
  type: string;
  timestamp: string;
  chain: string;
  transfers: {
    direction: string;
    symbol: string;
    quantity: number;
    valueUsd: number;
  }[];
}

export interface NftCollection {
  name: string;
  count: number;
  floorPrice: number;
  chain: string;
}

// ---------------------------------------------------------------------------
// Internal: API key & auth headers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.ZERION_API_KEY;
  if (!key) throw new Error("ZERION_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${getApiKey()}:`).toString("base64")}`,
    Accept: "application/json",
  };
}

// ---------------------------------------------------------------------------
// Internal: cache (keyed by full URL, 5 min TTL)
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Internal: fetch with retry (exponential backoff on 429, 503 bootstrap)
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: headers(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.ok) return res;

    if (res.status === 429 || res.status === 503) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1_000
        : BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[zerion] ${res.status} on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      lastError = new Error(`Zerion API ${res.status}`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Zerion API ${res.status} ${res.statusText}`);
  }

  throw lastError ?? new Error("Zerion API failed after retries");
}

async function fetchJson<T>(url: string): Promise<T> {
  const cached = getCached<T>(url);
  if (cached) {
    console.log(`[zerion] Cache hit: ${url.slice(0, 80)}...`);
    return cached;
  }

  const res = await fetchWithRetry(url);
  const json = (await res.json()) as T;
  setCache(url, json);
  return json;
}

// ---------------------------------------------------------------------------
// Zerion raw response types (not exported — internal mapping only)
// ---------------------------------------------------------------------------

interface ZerionPortfolioResponse {
  data: {
    attributes: {
      total: { positions: number };
      changes: { absolute_1d: number; percent_1d: number };
      positions_distribution_by_chain: Record<string, number>;
    };
  };
}

interface ZerionPositionsResponse {
  data: {
    attributes: {
      fungible_info: { name: string; symbol: string };
      value: number | null;
      quantity: { float: number };
      protocol: string | null;
      position_type: string;
      name: string | null;
    };
    relationships: { chain: { data: { id: string } } };
  }[];
}

interface ZerionPnlResponse {
  data: {
    attributes: {
      realized_gain: number;
      unrealized_gain: number;
      total_fee: number;
      net_invested: number;
    };
  };
}

interface ZerionTransactionsResponse {
  data: {
    attributes: {
      operation_type: string;
      mined_at: string;
      transfers: {
        direction: string;
        fungible_info?: { symbol: string };
        quantity: { float: number };
        value: number | null;
      }[];
    };
    relationships: { chain: { data: { id: string } } };
  }[];
}

interface ZerionNftCollectionsResponse {
  data: {
    attributes: {
      collection_info: { name: string };
      nfts_count: string | number;
      total_floor_price: number | null;
    };
    relationships: { chains: { data: { id: string }[] } };
  }[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a wallet's portfolio summary: total value, chains, 24 h change.
 */
export async function fetchPortfolio(address: string): Promise<PortfolioData> {
  const url = `${BASE_URL}/wallets/${address}/portfolio?currency=usd`;
  const json = await fetchJson<ZerionPortfolioResponse>(url);
  const attrs = json.data.attributes;

  return {
    totalValueUsd: attrs.total.positions,
    chains: Object.keys(attrs.positions_distribution_by_chain ?? {}),
    change24hPercent: (attrs.changes.percent_1d ?? 0) * 100,
    change24hUsd: attrs.changes.absolute_1d ?? 0,
  };
}

/**
 * Fetch simple (wallet) token positions sorted by value descending.
 */
export async function fetchPositions(
  address: string,
  type: string = "only_simple",
): Promise<Position[]> {
  const url =
    `${BASE_URL}/wallets/${address}/positions/` +
    `?filter[positions]=${type}` +
    `&filter[trash]=only_non_trash` +
    `&currency=usd` +
    `&page[size]=100` +
    `&sort=-value`;

  const json = await fetchJson<ZerionPositionsResponse>(url);

  const valid = json.data.filter(
    (p) => p.attributes.value != null && p.attributes.value > 0,
  );
  const totalValue = valid.reduce((s, p) => s + (p.attributes.value ?? 0), 0);

  return valid.map((p) => ({
    asset: p.attributes.fungible_info.symbol,
    name: p.attributes.fungible_info.name,
    valueUsd: p.attributes.value!,
    quantity: p.attributes.quantity.float,
    chain: p.relationships.chain.data.id,
    percentage:
      totalValue > 0
        ? Math.round((p.attributes.value! / totalValue) * 1000) / 10
        : 0,
  }));
}

/**
 * Fetch DeFi (complex) positions: staked, deposited, locked, reward.
 */
export async function fetchDefiPositions(
  address: string,
): Promise<DefiPosition[]> {
  const url =
    `${BASE_URL}/wallets/${address}/positions/` +
    `?filter[positions]=only_complex` +
    `&currency=usd` +
    `&sort=-value`;

  const json = await fetchJson<ZerionPositionsResponse>(url);

  return json.data
    .filter((p) => p.attributes.value != null)
    .map((p) => {
      const posType = p.attributes.position_type as DefiPosition["type"];
      return {
        protocol: p.attributes.protocol ?? "Unknown",
        type: posType,
        asset: p.attributes.name ?? p.attributes.fungible_info.symbol,
        valueUsd: p.attributes.value!,
        chain: p.relationships.chain.data.id,
      };
    });
}

/**
 * Fetch wallet Profit & Loss (FIFO).
 */
export async function fetchPnl(address: string): Promise<PnlData> {
  const url = `${BASE_URL}/wallets/${address}/pnl?currency=usd`;
  const json = await fetchJson<ZerionPnlResponse>(url);
  const attrs = json.data.attributes;

  return {
    realizedGain: attrs.realized_gain,
    unrealizedGain: attrs.unrealized_gain,
    totalFees: attrs.total_fee,
    netInvested: attrs.net_invested,
  };
}

/**
 * Fetch recent transactions for a wallet.
 */
export async function fetchTransactions(
  address: string,
  limit: number = 20,
): Promise<Transaction[]> {
  const url =
    `${BASE_URL}/wallets/${address}/transactions/` +
    `?currency=usd` +
    `&page[size]=${limit}`;

  const json = await fetchJson<ZerionTransactionsResponse>(url);

  return json.data.map((tx) => ({
    type: tx.attributes.operation_type,
    timestamp: tx.attributes.mined_at,
    chain: tx.relationships.chain.data.id,
    transfers: tx.attributes.transfers.map((t) => ({
      direction: t.direction,
      symbol: t.fungible_info?.symbol ?? "NFT",
      quantity: t.quantity.float,
      valueUsd: t.value ?? 0,
    })),
  }));
}

/**
 * Fetch NFT collections held by a wallet, sorted by floor price descending.
 */
export async function fetchNftCollections(
  address: string,
): Promise<NftCollection[]> {
  const url =
    `${BASE_URL}/wallets/${address}/nft-collections/` +
    `?currency=usd` +
    `&sort=-total_floor_price`;

  const json = await fetchJson<ZerionNftCollectionsResponse>(url);

  return json.data.map((c) => ({
    name: c.attributes.collection_info.name,
    count: typeof c.attributes.nfts_count === "string" ? parseInt(c.attributes.nfts_count, 10) : c.attributes.nfts_count,
    floorPrice: c.attributes.total_floor_price ?? 0,
    chain: c.relationships.chains?.data?.[0]?.id ?? "unknown",
  }));
}
