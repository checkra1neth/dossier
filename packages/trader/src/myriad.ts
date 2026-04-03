import type { Signal, TradeResult } from "@wire/shared/types";

interface MyriadOutcome {
  title: string;
  price: number;
}

interface MyriadMarket {
  id: number;
  slug: string;
  title: string;
  state: string;
  topics: string[];
  volume24h: number;
  liquidity: number;
  outcomes: MyriadOutcome[];
}

interface MyriadResponse {
  data: MyriadMarket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Score how relevant a Myriad market is to the signal asset.
 * Higher = better match.
 */
function relevanceScore(market: MyriadMarket, asset: string): number {
  const assetLower = asset.toLowerCase();
  const titleLower = market.title.toLowerCase();
  let score = 0;

  // Direct mention in title is strongest signal
  if (titleLower.includes(assetLower)) score += 10;

  // Crypto topic is relevant for crypto assets
  if (market.topics.includes("Crypto")) score += 3;

  // Prefer markets with recent activity
  if (market.volume24h > 0) score += 2;

  // Prefer markets with liquidity
  if (market.liquidity > 100) score += 1;

  return score;
}

async function fetchMarkets(url: string): Promise<MyriadResponse> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Myriad API ${res.status}`);
  return (await res.json()) as MyriadResponse;
}

export async function executeMyriadTrade(signal: Signal): Promise<TradeResult> {
  const keyword = signal.asset.replace(/[^a-zA-Z0-9]/g, " ").trim();

  try {
    // First try keyword search
    const keywordUrl = `https://api-v2.myriadprotocol.com/markets?state=open&keyword=${encodeURIComponent(keyword)}&limit=20`;
    let body = await fetchMarkets(keywordUrl);
    let markets = body.data;

    // If keyword search returns nothing, fetch all open markets and pick the most relevant
    if (markets.length === 0) {
      console.log(`[trader/myriad] No results for keyword "${keyword}", fetching all open markets`);
      const allUrl = `https://api-v2.myriadprotocol.com/markets?state=open&limit=10`;
      body = await fetchMarkets(allUrl);
      markets = body.data;
    }

    if (markets.length === 0) {
      return {
        signalId: signal.id,
        platform: "myriad",
        action: `NO_MARKETS_AVAILABLE — Myriad has no open markets`,
        amount: 0,
        status: "failed",
      };
    }

    // Rank by relevance to the signal asset, pick the best match
    const ranked = markets
      .map((m) => ({ market: m, score: relevanceScore(m, keyword) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    const market = best.market;

    console.log(
      `[trader/myriad] Found ${markets.length} markets for "${keyword}" (total: ${body.pagination.total}), ` +
        `best: "${market.title}" (score ${best.score})`
    );
    console.log(
      `[trader/myriad] Outcomes:`,
      market.outcomes.map((o) => `${o.title}: $${o.price.toFixed(4)}`).join(", ")
    );

    const outcome =
      signal.action === "BUY"
        ? market.outcomes[0]
        : market.outcomes[market.outcomes.length - 1];
    const amount = outcome ? outcome.price * 100 : 10;

    return {
      signalId: signal.id,
      platform: "myriad",
      action: `${signal.action} "${market.title}" — ${outcome?.title ?? "YES"} @ $${outcome?.price ?? 0}`,
      amount,
      status: "success",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[trader/myriad] API error: ${msg}`);
    return {
      signalId: signal.id,
      platform: "myriad",
      action: `FAILED ${signal.action} ${signal.asset} — ${msg}`,
      amount: 0,
      status: "failed",
    };
  }
}
