import type { AgentName, WireMessage } from "./types.ts";
import { getWalletKey } from "./config.ts";
import { privateKeyToAccount } from "viem/accounts";

// Message bus for inter-agent communication (HTTP-based fallback when XMTP native bindings unavailable)
// In production, this would be real XMTP. For hackathon demo, HTTP bus provides identical UX.

export interface WireAgent {
  address: string;
  name: AgentName;
  groupId: string | null;
  listeners: Array<(msg: WireMessage) => void>;
}

// Global message bus (shared across agents in same process, or via HTTP for separate processes)
const MESSAGE_BUS_PORT = 4099;
let busServer: any = null;
const registeredAgents = new Map<string, WireAgent>();
const messageListeners = new Map<string, Array<(msg: WireMessage) => void>>();

export async function createWireAgent(name: AgentName): Promise<WireAgent> {
  const walletKey = getWalletKey(name);
  const account = privateKeyToAccount(walletKey);

  const wireAgent: WireAgent = {
    address: account.address,
    name,
    groupId: null,
    listeners: [],
  };

  registeredAgents.set(name, wireAgent);
  console.log(`[${name}] Agent online: ${account.address}`);

  return wireAgent;
}

export async function createGroup(_wireAgent: WireAgent, _memberAddresses: string[]): Promise<string> {
  const groupId = `wire-group-${Date.now()}`;
  _wireAgent.groupId = groupId;
  console.log(`[${_wireAgent.name}] Created group: ${groupId}`);
  return groupId;
}

export async function sendToGroup(wireAgent: WireAgent, msg: WireMessage): Promise<void> {
  // Send to all other agents via HTTP
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
      // Agent not running yet, skip
    }
  }
}

export async function sendDM(fromAgent: WireAgent, toAddress: string, text: string): Promise<void> {
  // For demo: log the DM. In production, this would use XMTP DM.
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

// Express middleware to handle incoming wire messages
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
