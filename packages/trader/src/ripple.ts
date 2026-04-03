import { Client, Wallet, xrpToDrops } from "xrpl";
import type { Signal, TradeResult } from "@wire/shared/types";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

export async function executeRipplePayment(signal: Signal): Promise<TradeResult> {
  const client = new Client(TESTNET_URL);

  try {
    await client.connect();
    console.log("[trader/ripple] Connected to XRPL testnet");

    // Generate and fund two wallets via faucet
    const [sender, receiver] = await Promise.all([
      client.fundWallet(),
      client.fundWallet(),
    ]);

    console.log(`[trader/ripple] Sender: ${sender.wallet.classicAddress}`);
    console.log(`[trader/ripple] Receiver: ${receiver.wallet.classicAddress}`);

    // Send 1 XRP payment
    const prepared = await client.autofill({
      TransactionType: "Payment",
      Account: sender.wallet.classicAddress,
      Amount: xrpToDrops("1"),
      Destination: receiver.wallet.classicAddress,
    });

    const signed = sender.wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const txHash = typeof result.result.hash === "string" ? result.result.hash : signed.hash;
    const engineResult = result.result.meta && typeof result.result.meta === "object" && "TransactionResult" in result.result.meta
      ? (result.result.meta as { TransactionResult: string }).TransactionResult
      : "unknown";

    console.log(`[trader/ripple] Payment submitted: ${txHash} — ${engineResult}`);

    await client.disconnect();

    return {
      signalId: signal.id,
      platform: "ripple",
      action: `XRPL cross-border payment: 1 XRP ${sender.wallet.classicAddress.slice(0, 8)}... → ${receiver.wallet.classicAddress.slice(0, 8)}... (${engineResult})`,
      amount: 1,
      status: engineResult === "tesSUCCESS" ? "success" : "failed",
      txHash,
    };
  } catch (err) {
    console.log(`[trader/ripple] Error: ${err instanceof Error ? err.message : err}`);
    try { await client.disconnect(); } catch {}

    const msg = err instanceof Error ? err.message : String(err);
    return {
      signalId: signal.id,
      platform: "ripple",
      action: `FAILED XRPL cross-border payment for ${signal.asset} — ${msg}`,
      amount: 0,
      status: "failed",
    };
  }
}
