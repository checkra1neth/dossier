/**
 * Comprehensive Zerion API client for Dossier.
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

export interface NftPosition {
  name: string;
  collectionName: string;
  imageUrl: string | null;
  collectionIcon: string | null;
  valueUsd: number;
  chain: string;
  tokenId: string;
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

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chain: string;
  price: number;
}

interface ZerionFungiblesResponse {
  data: {
    id: string;
    attributes: {
      name: string;
      symbol: string;
      market_data?: { price: number | null };
      implementations: {
        chain_id: string;
        address: string | null;
        decimals: number;
      }[];
    };
  }[];
}

const NATIVE_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/**
 * Resolve a token by name or symbol, returning its on-chain address and decimals
 * for the requested chain.
 */
export async function resolveToken(
  query: string,
  chainId: string = "base",
): Promise<TokenInfo | null> {
  // Short-circuit for native token aliases
  const normalized = query.trim().toLowerCase();
  if (normalized === "eth" || normalized === "ether" || normalized === "ethereum") {
    return {
      id: "eth",
      symbol: "ETH",
      name: "Ethereum",
      address: NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      chain: chainId,
      price: 0, // caller can enrich if needed
    };
  }

  const url =
    `${BASE_URL}/fungibles/` +
    `?filter%5Bsearch_query%5D=${encodeURIComponent(query)}` +
    `&currency=usd` +
    `&page%5Bsize%5D=5`;

  const json = await fetchJson<ZerionFungiblesResponse>(url);

  if (!json.data || json.data.length === 0) return null;

  // Find the first result that has an implementation on the target chain
  for (const token of json.data) {
    const impl = token.attributes.implementations.find(
      (i) => i.chain_id === chainId,
    );
    if (impl) {
      return {
        id: token.id,
        symbol: token.attributes.symbol,
        name: token.attributes.name,
        address: impl.address ?? NATIVE_TOKEN_ADDRESS,
        decimals: impl.decimals,
        chain: chainId,
        price: token.attributes.market_data?.price ?? 0,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Swap / Bridge offers
// ---------------------------------------------------------------------------

export interface SwapOffer {
  source: string;
  outputQuantity: string;
  outputSymbol: string;
  gas: number;
  transaction: {
    to: string;
    from: string;
    chainId: string;
    gas: number;
    data: string;
    value: string;
  };
  slippage: string;
}

interface ZerionSwapResponse {
  data: {
    id: string;
    attributes: {
      source: { name: string };
      slippage_percent: number;
      output_quantity: string;
      output_token: { symbol: string };
      transaction: {
        to: string;
        from: string;
        chain_id: string;
        gas: number;
        data: string;
        value: string;
      };
    };
  }[];
}

/**
 * Fetch swap/bridge offers from Zerion. For bridges, set different
 * inputChain / outputChain values.
 */
export async function fetchSwapOffers(params: {
  fromAddress: string;
  inputChain: string;
  inputToken: string;
  inputAmount: string;
  outputChain: string;
  outputToken: string;
  slippage?: number;
}): Promise<SwapOffer[]> {
  const slippage = params.slippage ?? 2;

  const url =
    `${BASE_URL}/swap/offers/` +
    `?input%5Bfrom%5D=${params.fromAddress}` +
    `&input%5Bchain_id%5D=${params.inputChain}` +
    `&input%5Basset_address%5D=${params.inputToken}` +
    `&input%5Bamount%5D=${params.inputAmount}` +
    `&output%5Bchain_id%5D=${params.outputChain}` +
    `&output%5Basset_address%5D=${params.outputToken}` +
    `&slippage_percent=${slippage}`;

  const json = await fetchJson<ZerionSwapResponse>(url);

  if (!json.data || json.data.length === 0) return [];

  return json.data
    .map((offer) => ({
      source: offer.attributes.source.name,
      outputQuantity: offer.attributes.output_quantity,
      outputSymbol: offer.attributes.output_token.symbol,
      gas: offer.attributes.transaction.gas,
      transaction: {
        to: offer.attributes.transaction.to,
        from: offer.attributes.transaction.from,
        chainId: offer.attributes.transaction.chain_id,
        gas: offer.attributes.transaction.gas,
        data: offer.attributes.transaction.data,
        value: offer.attributes.transaction.value,
      },
      slippage: `${offer.attributes.slippage_percent}%`,
    }))
    .sort(
      (a, b) =>
        parseFloat(b.outputQuantity) - parseFloat(a.outputQuantity),
    );
}

/**
 * Fetch NFT collections held by a wallet, sorted by floor price descending.
 */
export async function fetchNftPositions(
  address: string,
  limit: number = 20,
): Promise<NftPosition[]> {
  const url =
    `${BASE_URL}/wallets/${address}/nft-positions/` +
    `?currency=usd` +
    `&sort=-floor_price` +
    `&page[size]=${limit}`;

  const json = await fetchJson<{
    data: {
      attributes: {
        nft_info: {
          name: string;
          token_id: string;
          content?: { preview?: { url: string }; detail?: { url: string } };
        };
        collection_info: {
          name: string;
          content?: { icon?: { url: string } };
        };
        value: number | null;
      };
      relationships: { chain: { data: { id: string } } };
    }[];
  }>(url);

  return json.data.map((p) => {
    const nft = p.attributes.nft_info;
    const col = p.attributes.collection_info;
    return {
      name: nft.name || `#${nft.token_id.length > 8 ? nft.token_id.slice(0, 8) + "..." : nft.token_id}`,
      collectionName: col.name,
      imageUrl: nft.content?.preview?.url ?? nft.content?.detail?.url ?? null,
      collectionIcon: col.content?.icon?.url ?? null,
      valueUsd: p.attributes.value ?? 0,
      chain: p.relationships.chain.data.id,
      tokenId: nft.token_id,
    };
  });
}

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
