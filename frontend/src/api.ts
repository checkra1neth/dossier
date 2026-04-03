export type Command = "quick" | "research" | "pnl" | "defi" | "history" | "nft" | "compare";

export const COMMANDS: { cmd: Command; label: string; price: string }[] = [
  { cmd: "quick", label: "/quick", price: "$0.01" },
  { cmd: "research", label: "/research", price: "$0.05" },
  { cmd: "pnl", label: "/pnl", price: "$0.02" },
  { cmd: "defi", label: "/defi", price: "$0.02" },
  { cmd: "history", label: "/history", price: "$0.02" },
  { cmd: "nft", label: "/nft", price: "$0.02" },
  { cmd: "compare", label: "/compare", price: "$0.05" },
];

export function getPrice(cmd: Command): string {
  return COMMANDS.find((c) => c.cmd === cmd)?.price ?? "$0.05";
}

export async function query<T>(command: Command, body: Record<string, string>): Promise<T> {
  const res = await fetch(`/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
