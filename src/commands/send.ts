import { resolveToken, type TokenInfo } from "../services/zerion.ts";
import { getWalletInfo, signAndSendTx } from "../services/ows.ts";
import { encodeFunctionData, parseUnits, serializeTransaction, type TransactionSerializable } from "viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendRequest {
  amount: number;
  symbol: string;
  toAddress: string;
  chain: string;
}

export interface SendResult {
  request: SendRequest;
  fromAddress: string;
  token: TokenInfo;
  status: "pending_confirm" | "executed" | "failed";
  txResult?: string;
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
// Parse "/send 10 USDC to 0xABC... [on base]"
// ---------------------------------------------------------------------------

const SEND_PATTERN =
  /^\/send\s+([\d.]+)\s+(\S+)\s+to\s+(0x[a-fA-F0-9]{40})(?:\s+on\s+(\S+))?$/i;

export function parseSendCommand(text: string): SendRequest | null {
  const match = text.trim().match(SEND_PATTERN);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    symbol: match[2].toUpperCase(),
    toAddress: match[3],
    chain: resolveChain(match[4] ?? "base"),
  };
}

// ---------------------------------------------------------------------------
// Prepare send (resolve token, return pending_confirm)
// ---------------------------------------------------------------------------

const NATIVE_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const CHAIN_IDS: Record<string, string> = {
  base: "8453",
  ethereum: "1",
  arbitrum: "42161",
  optimism: "10",
  polygon: "137",
  avalanche: "43114",
  "binance-smart-chain": "56",
};

export async function handleSend(
  request: SendRequest,
  walletName: string,
): Promise<SendResult> {
  const walletInfo = getWalletInfo(walletName);
  const token = await resolveToken(request.symbol, request.chain);

  if (!token) {
    throw new Error(
      `Cannot resolve token "${request.symbol}" on ${request.chain}`,
    );
  }

  return {
    request,
    fromAddress: walletInfo.address,
    token,
    status: "pending_confirm",
  };
}

// ---------------------------------------------------------------------------
// Format confirmation message
// ---------------------------------------------------------------------------

export function sendToText(result: SendResult): string {
  const { request, fromAddress, token } = result;
  const fromShort = `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`;
  const toShort = `${request.toAddress.slice(0, 6)}...${request.toAddress.slice(-4)}`;
  const isNative = token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
  const tokenType = isNative ? "native" : "ERC-20";

  return [
    `📤 Send Preview`,
    `  ${request.amount} ${request.symbol} (${tokenType})`,
    `  From: ${fromShort}`,
    `  To:   ${toShort}`,
    `  Chain: ${request.chain}`,
    `  Token: ${token.name} (${token.address.slice(0, 10)}...)`,
    ``,
    `Type 'confirm' to execute or 'cancel'`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// ERC-20 transfer ABI (minimal)
// ---------------------------------------------------------------------------

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Execute the send (called after user confirms)
// ---------------------------------------------------------------------------

export async function executeSend(
  result: SendResult,
  walletName: string,
): Promise<string> {
  const { request, fromAddress, token } = result;
  const isNative = token.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
  const amountWei = parseUnits(request.amount.toString(), token.decimals);
  const numericChainId = CHAIN_IDS[request.chain] ?? "8453";

  let txPayload: Record<string, string>;

  if (isNative) {
    txPayload = {
      from: fromAddress,
      to: request.toAddress,
      value: `0x${amountWei.toString(16)}`,
      data: "0x",
      chainId: numericChainId,
    };
  } else {
    const calldata = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [request.toAddress as `0x${string}`, amountWei],
    });

    txPayload = {
      from: fromAddress,
      to: token.address,
      value: "0x0",
      data: calldata,
      chainId: numericChainId,
    };
  }

  // Serialize as RLP-encoded unsigned EIP-1559 transaction with gas
  const isErc20 = txPayload.data !== "0x";
  const tx: TransactionSerializable = {
    to: txPayload.to as `0x${string}`,
    value: BigInt(txPayload.value),
    data: (isErc20 ? txPayload.data : undefined) as `0x${string}` | undefined,
    chainId: parseInt(numericChainId),
    type: "eip1559" as const,
    gas: BigInt(isErc20 ? 65000 : 21000),
    maxFeePerGas: BigInt(1_000_000_000), // 1 gwei
    maxPriorityFeePerGas: BigInt(1_000_000), // 0.001 gwei
    nonce: 0, // OWS will override with correct nonce
  };
  const serialized = serializeTransaction(tx);
  // Remove 0x prefix for OWS CLI
  const txHex = serialized.startsWith("0x") ? serialized.slice(2) : serialized;
  const txResult = signAndSendTx(walletName, request.chain, txHex);
  return txResult;
}
