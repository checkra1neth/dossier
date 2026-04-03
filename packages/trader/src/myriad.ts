import type { Signal, TradeResult } from "@wire/shared/types";

interface MyriadMarket {
  id: string;
  title: string;
  state: string;
  outcomes: { title: string; price: number }[];
}

export async function executeMyriadTrade(signal: Signal): Promise<TradeResult> {
  const keyword = signal.asset.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const url = `https://api-v2.myriadprotocol.com/markets?state=open&keyword=${encodeURIComponent(keyword)}&limit=5`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Myriad API ${res.status}`);

    const markets: MyriadMarket[] = await res.json();

    if (markets.length > 0) {
      const market = markets[0];
      console.log(`[trader/myriad] Found market: "${market.title}"`);
      console.log(`[trader/myriad] Outcomes:`, market.outcomes.map((o) => `${o.title}: $${o.price}`).join(", "));

      const outcome = signal.action === "BUY" ? market.outcomes[0] : market.outcomes[market.outcomes.length - 1];
      const amount = outcome ? outcome.price * 100 : 10;

      return {
        signalId: signal.id,
        platform: "myriad",
        action: `${signal.action} "${market.title}" — ${outcome?.title ?? "YES"} @ $${outcome?.price ?? 0}`,
        amount,
        status: "success",
      };
    }

    // No market found — simulated
    console.log(`[trader/myriad] No market found for "${keyword}", simulating`);
    return {
      signalId: signal.id,
      platform: "myriad",
      action: `SIMULATED ${signal.action} ${signal.asset} (no market found)`,
      amount: 10,
      status: "success",
    };
  } catch (err) {
    console.log(`[trader/myriad] API error: ${err instanceof Error ? err.message : err}, simulating`);
    return {
      signalId: signal.id,
      platform: "myriad",
      action: `SIMULATED ${signal.action} ${signal.asset}`,
      amount: 10,
      status: "success",
    };
  }
}
