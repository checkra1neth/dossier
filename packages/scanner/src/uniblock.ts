import { envOptional } from "@wire/shared/config";

const UNIBLOCK_BASE = "https://api.uniblock.dev/uni/v1/json-rpc";

export async function getBalance(address: string, chainId: number = 1): Promise<string> {
  const apiKey = envOptional("UNIBLOCK_API_KEY");
  if (!apiKey) {
    return "unknown";
  }

  try {
    const res = await fetch(UNIBLOCK_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
        chainId,
      }),
    });

    const data = await res.json();
    if (data.result) {
      const wei = BigInt(data.result);
      const eth = Number(wei) / 1e18;
      return `${eth.toFixed(4)} ETH on chain ${chainId}`;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
