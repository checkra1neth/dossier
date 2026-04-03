import {
  resolveToken,
  fetchSwapOffers,
  type TokenInfo,
} from "../services/zerion.ts";
import { type SwapOffer, type SwapResult, executeSwap } from "./swap.ts";

export { executeSwap };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeRequest {
  amount: number;
  symbol: string;
  fromChain: string;
  toChain: string;
}

// ---------------------------------------------------------------------------
// Chain alias helpers (same mapping as swap)
// ---------------------------------------------------------------------------

const CHAIN_ALIASES: Record<string, string> = {
  base: "base",
  ethereum: "ethereum",
  eth: "ethereum",
  mainnet: "ethereum",
  arbitrum: "arbitrum",
  arb: "arbitrum",
  optimism: "optimism",
  op: "optimism",
  polygon: "polygon",
  matic: "polygon",
  avalanche: "avalanche",
  avax: "avalanche",
  bsc: "binance-smart-chain",
  bnb: "binance-smart-chain",
};

function resolveChain(input: string): string {
  return CHAIN_ALIASES[input.toLowerCase()] ?? input.toLowerCase();
}

// ---------------------------------------------------------------------------
// Parse "/bridge 100 USDC from base to ethereum"
// ---------------------------------------------------------------------------

const BRIDGE_PATTERN =
  /^\/bridge\s+([\d.]+)\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)$/i;

export function parseBridgeCommand(text: string): BridgeRequest | null {
  const match = text.trim().match(BRIDGE_PATTERN);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    symbol: match[2].toUpperCase(),
    fromChain: resolveChain(match[3]),
    toChain: resolveChain(match[4]),
  };
}

// ---------------------------------------------------------------------------
// Get best bridge offer
// ---------------------------------------------------------------------------

export async function handleBridge(
  request: BridgeRequest,
  walletAddress: string,
): Promise<SwapResult> {
  // Resolve the same token on both chains
  const [inputToken, outputToken] = await Promise.all([
    resolveToken(request.symbol, request.fromChain),
    resolveToken(request.symbol, request.toChain),
  ]);

  if (!inputToken) {
    throw new Error(
      `Cannot resolve "${request.symbol}" on ${request.fromChain}`,
    );
  }
  if (!outputToken) {
    throw new Error(
      `Cannot resolve "${request.symbol}" on ${request.toChain}`,
    );
  }

  const amountInSmallest = BigInt(
    Math.round(request.amount * 10 ** inputToken.decimals),
  ).toString();

  const offers = await fetchSwapOffers({
    fromAddress: walletAddress,
    inputChain: request.fromChain,
    inputToken: inputToken.address,
    inputAmount: amountInSmallest,
    outputChain: request.toChain,
    outputToken: outputToken.address,
  });

  if (offers.length === 0) {
    throw new Error(
      `No bridge offers for ${request.symbol} from ${request.fromChain} to ${request.toChain}`,
    );
  }

  return {
    offer: offers[0],
    inputToken,
    outputToken,
    status: "pending_confirm",
  };
}

// ---------------------------------------------------------------------------
// Format bridge offer for user confirmation
// ---------------------------------------------------------------------------

export function bridgeOfferToText(
  request: BridgeRequest,
  result: SwapResult,
): string {
  const { offer } = result;
  const outputHuman = parseFloat(offer.outputQuantity);
  const outputStr =
    outputHuman >= 0.001 ? outputHuman.toFixed(6) : offer.outputQuantity;

  return [
    `🌉 Bridge Preview`,
    `  ${request.amount} ${request.symbol} (${request.fromChain}) -> ${outputStr} ${offer.outputSymbol} (${request.toChain})`,
    `  Source: ${offer.source}`,
    `  Slippage: ${offer.slippage}`,
    `  Gas: ${offer.gas.toLocaleString()}`,
    ``,
    `Type 'confirm' to execute or 'cancel'`,
  ].join("\n");
}
