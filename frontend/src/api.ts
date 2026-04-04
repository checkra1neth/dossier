export type Command = "quick" | "research" | "pnl" | "defi" | "history" | "nft" | "compare" | "balance" | "swap" | "bridge" | "send" | "watch" | "unwatch";

export const COMMANDS: { cmd: Command; label: string; price: string }[] = [
  { cmd: "quick", label: "/quick", price: "$0.01" },
  { cmd: "research", label: "/research", price: "$0.05" },
  { cmd: "pnl", label: "/pnl", price: "$0.02" },
  { cmd: "defi", label: "/defi", price: "$0.02" },
  { cmd: "history", label: "/history", price: "$0.02" },
  { cmd: "nft", label: "/nft", price: "$0.02" },
  { cmd: "compare", label: "/compare", price: "$0.05" },
  { cmd: "balance", label: "/balance", price: "FREE" },
  { cmd: "swap", label: "/swap", price: "$0.01" },
  { cmd: "bridge", label: "/bridge", price: "$0.01" },
  { cmd: "send", label: "/send", price: "$0.01" },
  { cmd: "watch", label: "/watch", price: "$0.10" },
  { cmd: "unwatch", label: "/unwatch", price: "FREE" },
];

export function getPrice(cmd: Command): string {
  return COMMANDS.find((c) => c.cmd === cmd)?.price ?? "$0.05";
}

// Bridge session ID — set by useBridge hook when connected
let bridgeSessionId: string | null = null;

export function setBridgeSession(id: string | null): void {
  bridgeSessionId = id;
}

export async function query<T>(command: Command, body: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bridgeSessionId) {
    headers["X-Bridge-Session"] = bridgeSessionId;
  }
  const res = await fetch(`/api/${command}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    throw new Error(`Payment required: ${getPrice(command)} USDC on Base`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function queryGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

