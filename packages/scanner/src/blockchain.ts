import { envOptional } from "@wire/shared/config";

export interface AlliumTx {
  hash: string;
  from: string;
  to: string;
  value: string; // ETH as string
  chain: string;
}

const WEI_PER_ETH = 1e18;
const MIN_VALUE_ETH = 10;
const POLL_INTERVAL_MS = 10_000;

function getRpcUrl(): string {
  const uniblockKey = envOptional("UNIBLOCK_API_KEY");
  if (uniblockKey) {
    return `https://api.uniblock.dev/uni/v1/ethereum?apikey=${uniblockKey}`;
  }
  console.log("[scanner] No UNIBLOCK_API_KEY — using Cloudflare public RPC");
  return "https://cloudflare-eth.com";
}

interface RpcResponse {
  result: {
    number: string;
    hash: string;
    transactions: {
      hash: string;
      from: string;
      to: string | null;
      value: string;
    }[];
  } | null;
  error?: { code: number; message: string };
}

let lastBlockNumber: string | null = null;

async function fetchLatestBlock(rpcUrl: string): Promise<RpcResponse> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: ["latest", true],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`RPC returned ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as RpcResponse;
}

export function startBlockchainStream(onEvent: (tx: AlliumTx) => void): void {
  const rpcUrl = getRpcUrl();
  console.log(`[scanner] Polling Ethereum blocks every ${POLL_INTERVAL_MS / 1000}s via ${rpcUrl.includes("uniblock") ? "Uniblock" : "Cloudflare"} RPC`);

  const poll = async (): Promise<void> => {
    try {
      const data = await fetchLatestBlock(rpcUrl);

      if (data.error) {
        console.error(`[scanner] RPC error: ${data.error.message}`);
        return;
      }

      const block = data.result;
      if (!block) {
        console.warn("[scanner] No block data in response");
        return;
      }

      // Skip if we already processed this block
      if (block.number === lastBlockNumber) return;
      lastBlockNumber = block.number;

      const blockNum = parseInt(block.number, 16);
      const txCount = block.transactions.length;

      let whaleCount = 0;
      for (const tx of block.transactions) {
        const valueWei = BigInt(tx.value);
        const valueEth = Number(valueWei) / WEI_PER_ETH;

        if (valueEth >= MIN_VALUE_ETH && tx.to) {
          whaleCount++;
          const alliumTx: AlliumTx = {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: valueEth.toFixed(4),
            chain: "ethereum",
          };
          onEvent(alliumTx);
        }
      }

      if (whaleCount > 0) {
        console.log(`[scanner] Block ${blockNum}: ${txCount} txs, ${whaleCount} whale transfers (>= ${MIN_VALUE_ETH} ETH)`);
      }
    } catch (err) {
      console.error(`[scanner] Poll error: ${err instanceof Error ? err.message : err}`);
    }
  };

  // First poll immediately
  poll();
  // Then every POLL_INTERVAL_MS
  setInterval(poll, POLL_INTERVAL_MS);
}
