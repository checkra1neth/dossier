import type { Signal, TradeResult } from "@wire/shared/types";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const DFLOW_BASE = "https://quote-api.dflow.net";
const DFLOW_API_KEY = process.env.DFLOW_API_KEY ?? "";

/**
 * DFlow Pond Swap API — tries /intent first, falls back to /quote.
 */
export async function getDFlowQuote(signal: Signal): Promise<TradeResult> {
  const inputMint = signal.action === "BUY" ? USDC_MINT : SOL_MINT;
  const outputMint = signal.action === "BUY" ? SOL_MINT : USDC_MINT;
  const amount = signal.action === "BUY" ? 1_000_000 : 1_000_000_000; // 1 USDC or 1 SOL
  const slippageBps = 50;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (DFLOW_API_KEY) {
    headers["x-api-key"] = DFLOW_API_KEY;
  }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
  });

  // Try /intent endpoint first
  const endpoints = [`${DFLOW_BASE}/intent?${params}`, `${DFLOW_BASE}/quote?${params}`];

  for (const url of endpoints) {
    const endpointName = url.includes("/intent") ? "/intent" : "/quote";
    try {
      console.log(`[trader/dflow] Trying ${endpointName}...`);
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000),
      });

      console.log(`[trader/dflow] ${endpointName} response: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const body = await res.text();
        console.log(`[trader/dflow] ${endpointName} body: ${body.slice(0, 300)}`);
        if (res.status === 403) {
          console.warn(`[trader/dflow] ${endpointName} returned 403 — API key required (contact integrations@dflow.net)`);
        }
        continue; // Try next endpoint
      }

      const data = await res.json();
      console.log(`[trader/dflow] ${endpointName} data:`, JSON.stringify(data).slice(0, 300));

      return {
        signalId: signal.id,
        platform: "dflow",
        action: `${signal.action} SOL/USDC via DFlow ${endpointName} — outAmount: ${data.outAmount ?? "unknown"}, route: ${data.routePlan?.length ?? 0} hops`,
        amount: signal.action === "BUY" ? 1 : amount / 1e9,
        status: "success",
      };
    } catch (err) {
      console.error(`[trader/dflow] ${endpointName} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Both endpoints failed
  const msg = DFLOW_API_KEY
    ? "DFlow API unreachable on both /intent and /quote"
    : "DFlow API requires DFLOW_API_KEY (contact integrations@dflow.net)";

  console.error(`[trader/dflow] ${msg}`);
  return {
    signalId: signal.id,
    platform: "dflow",
    action: `FAILED ${signal.action} SOL/USDC via DFlow — ${msg}`,
    amount: 0,
    status: "failed",
  };
}
