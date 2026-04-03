import type { AgentName, WireMessage } from "./types.ts";
import {
  getWallet,
  createWallet,
  signMessage as owsSignMessage,
  listWallets,
} from "@open-wallet-standard/core";

// Each agent gets an OWS wallet with addresses on 8+ chains.
// Communication via HTTP message bus between agents.

export interface WireAgent {
  address: string;         // EVM address
  solanaAddress: string;   // Solana address
  walletName: string;      // OWS wallet name
  name: AgentName;
  groupId: string | null;
  listeners: Array<(msg: WireMessage) => void>;
  allAccounts: { chainId: string; address: string }[];
}

export async function createWireAgent(name: AgentName): Promise<WireAgent> {
  const walletName = `${name}-agent`;

  // Get or create OWS wallet
  let wallet;
  try {
    wallet = await getWallet(walletName);
  } catch {
    wallet = await createWallet(walletName);
  }

  const accounts = wallet.accounts ?? [];
  const evmAccount = accounts.find((a: any) => a.chainId?.startsWith("eip155:"));
  const solAccount = accounts.find((a: any) => a.chainId?.startsWith("solana:"));

  const wireAgent: WireAgent = {
    address: evmAccount?.address ?? "unknown",
    solanaAddress: solAccount?.address ?? "unknown",
    walletName,
    name,
    groupId: null,
    listeners: [],
    allAccounts: accounts.map((a: any) => ({ chainId: a.chainId, address: a.address })),
  };

  console.log(`[${name}] OWS wallet "${walletName}" — ${accounts.length} chains`);
  console.log(`[${name}]   EVM: ${wireAgent.address}`);
  console.log(`[${name}]   SOL: ${wireAgent.solanaAddress}`);

  // Sign a startup message to prove wallet ownership
  try {
    const sig = await owsSignMessage(walletName, "evm", `${name}-agent alive at ${Date.now()}`);
    console.log(`[${name}]   Signed startup proof: ${sig.signature.slice(0, 20)}...`);
  } catch (err) {
    console.warn(`[${name}]   Could not sign startup proof: ${(err as Error).message}`);
  }

  return wireAgent;
}

export async function sendToGroup(wireAgent: WireAgent, msg: WireMessage): Promise<void> {
  const { PORTS } = await import("./config.ts");
  const agents: AgentName[] = ["scanner", "enricher", "analyst", "distributor", "trader"];

  for (const agent of agents) {
    if (agent === wireAgent.name) continue;
    const port = PORTS[agent];
    try {
      await fetch(`http://localhost:${port}/wire-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
    } catch {
      // Agent not running yet
    }
  }
}

export async function sendDM(fromAgent: WireAgent, toAddress: string, text: string): Promise<void> {
  console.log(`[${fromAgent.name}] DM to ${toAddress.slice(0, 10)}...: ${text.slice(0, 80)}`);
}

export function onWireMessage(wireAgent: WireAgent, handler: (msg: WireMessage) => void): void {
  wireAgent.listeners.push(handler);
}

export function parseWireMessage(text: string): WireMessage | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed.type && parsed.from && parsed.timestamp && parsed.data) {
      return parsed as WireMessage;
    }
    return null;
  } catch {
    return null;
  }
}

export function makeWireMessage(
  from: AgentName,
  type: WireMessage["type"],
  data: WireMessage["data"]
): WireMessage {
  return { type, from, timestamp: Date.now(), data };
}

export function wireMessageHandler(wireAgent: WireAgent) {
  return (req: any, res: any) => {
    const msg = req.body as WireMessage;
    for (const listener of wireAgent.listeners) {
      try {
        listener(msg);
      } catch (err) {
        console.error(`[${wireAgent.name}] Listener error:`, err);
      }
    }
    res.json({ ok: true });
  };
}
