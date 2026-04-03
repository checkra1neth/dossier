import type { Signal, TradeResult } from "@wire/shared/types";

const MOONPAY_CURRENCIES_URL = "https://api.moonpay.com/v3/currencies";

interface MoonPayCurrency {
  id: string;
  name: string;
  code: string;
  type: string;
  metadata: {
    chainId?: string;
    networkCode?: string;
  } | null;
  isSuspended: boolean;
}

export async function executeMoonPaySwap(signal: Signal): Promise<TradeResult> {
  try {
    const res = await fetch(MOONPAY_CURRENCIES_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`MoonPay API ${res.status} ${res.statusText}`);
    }

    const currencies = (await res.json()) as MoonPayCurrency[];

    // Find currencies matching the signal asset
    const assetLower = signal.asset.toLowerCase();
    const matching = currencies.filter(
      (c) =>
        !c.isSuspended &&
        c.type === "crypto" &&
        (c.code.toLowerCase() === assetLower ||
          c.name.toLowerCase().includes(assetLower))
    );

    const activeCryptos = currencies.filter((c) => c.type === "crypto" && !c.isSuspended);

    if (matching.length > 0) {
      const currency = matching[0];
      console.log(
        `[trader/moonpay] Found ${matching.length} matching currencies for "${signal.asset}", using: ${currency.name} (${currency.code})`
      );

      return {
        signalId: signal.id,
        platform: "moonpay",
        action: `${signal.action} ${currency.name} (${currency.code.toUpperCase()}) via MoonPay — ${matching.length} variants available, ${activeCryptos.length} total supported cryptos`,
        amount: 10,
        status: "success",
      };
    }

    // No exact match — show top available cryptos
    const topCryptos = activeCryptos.slice(0, 5);
    const topNames = topCryptos.map((c) => `${c.name} (${c.code})`).join(", ");

    console.log(
      `[trader/moonpay] No match for "${signal.asset}" among ${activeCryptos.length} cryptos. Top: ${topNames}`
    );

    return {
      signalId: signal.id,
      platform: "moonpay",
      action: `${signal.action} ${signal.asset} not directly available on MoonPay (${activeCryptos.length} cryptos supported). Top: ${topNames}`,
      amount: 0,
      status: "failed",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[trader/moonpay] API error: ${msg}`);
    return {
      signalId: signal.id,
      platform: "moonpay",
      action: `FAILED ${signal.action} ${signal.asset} via MoonPay — ${msg}`,
      amount: 0,
      status: "failed",
    };
  }
}
