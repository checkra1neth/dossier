import {
  resolveToken,
  fetchSwapOffers,
  type SwapOffer,
  type TokenInfo,
} from "../services/zerion.ts";
import { signAndSendTx } from "../services/ows.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { SwapOffer };

export interface SwapRequest {
  amount: number;
  inputSymbol: string;
  outputSymbol: string;
  chain: string;
}

export interface SwapResult {
  offer: SwapOffer;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  txHash?: string;
  status: "pending_confirm" | "executed" | "failed";
}

// ---------------------------------------------------------------------------
// Chain alias helpers
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
// Parse "/swap 10 USDC to ETH on base"
// ---------------------------------------------------------------------------

const SWAP_PATTERN =
  /^\/swap\s+([\d.]+)\s+(\S+)\s+(?:to|for|->|=>)\s+(\S+)(?:\s+on\s+(\S+))?$/i;

export function parseSwapCommand(text: string): SwapRequest | null {
  const match = text.trim().match(SWAP_PATTERN);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    inputSymbol: match[2].toUpperCase(),
    outputSymbol: match[3].toUpperCase(),
    chain: resolveChain(match[4] ?? "base"),
  };
}

// ---------------------------------------------------------------------------
// Get best swap offer
// ---------------------------------------------------------------------------

export async function handleSwap(
  request: SwapRequest,
  walletAddress: string,
): Promise<SwapResult> {
  const [inputToken, outputToken] = await Promise.all([
    resolveToken(request.inputSymbol, request.chain),
    resolveToken(request.outputSymbol, request.chain),
  ]);

  if (!inputToken) {
    throw new Error(
      `Cannot resolve token "${request.inputSymbol}" on ${request.chain}`,
    );
  }
  if (!outputToken) {
    throw new Error(
      `Cannot resolve token "${request.outputSymbol}" on ${request.chain}`,
    );
  }

  // Convert human-readable amount to smallest unit (wei / base units)
  const amountInSmallest = BigInt(
    Math.round(request.amount * 10 ** inputToken.decimals),
  ).toString();

  const offers = await fetchSwapOffers({
    fromAddress: walletAddress,
    inputChain: request.chain,
    inputToken: inputToken.address,
    inputAmount: amountInSmallest,
    outputChain: request.chain,
    outputToken: outputToken.address,
  });

  if (offers.length === 0) {
    throw new Error(
      `No swap offers available for ${request.inputSymbol} -> ${request.outputSymbol} on ${request.chain}`,
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
// Format offer for user confirmation
// ---------------------------------------------------------------------------

export function swapOfferToText(
  request: SwapRequest,
  result: SwapResult,
): string {
  const { offer } = result;
  const outputHuman = parseFloat(offer.outputQuantity);
  const outputStr =
    outputHuman >= 0.001 ? outputHuman.toFixed(6) : offer.outputQuantity;

  return [
    `🔄 Swap Preview`,
    `  ${request.amount} ${request.inputSymbol} -> ${outputStr} ${offer.outputSymbol}`,
    `  Source: ${offer.source}`,
    `  Slippage: ${offer.slippage}`,
    `  Gas: ${offer.gas.toLocaleString()}`,
    `  Chain: ${request.chain}`,
    ``,
    `Type 'confirm' to execute or 'cancel'`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Execute the swap (called after user confirms)
// ---------------------------------------------------------------------------

export async function executeSwap(
  offer: SwapOffer,
  walletName: string,
  chain: string,
): Promise<string> {
  const tx = offer.transaction;

  // Build the transaction hex payload for the OWS CLI
  const txPayload = JSON.stringify({
    to: tx.to,
    from: tx.from,
    gas: `0x${tx.gas.toString(16)}`,
    data: tx.data,
    value: tx.value,
    chainId: tx.chainId,
  });

  const txHex = Buffer.from(txPayload).toString("hex");

  const result = signAndSendTx(walletName, chain, txHex);
  return result;
}
