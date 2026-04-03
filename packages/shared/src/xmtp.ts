import { Agent, createUser, createSigner } from "@xmtp/agent-sdk";
import type { AgentName, WireMessage } from "./types.ts";
import { getWalletKey, getDbEncryptionKey } from "./config.ts";

export interface WireAgent {
  agent: Agent;
  name: AgentName;
  groupId: string | null;
}

export async function createWireAgent(name: AgentName): Promise<WireAgent> {
  const walletKey = getWalletKey(name);
  const user = createUser(walletKey);
  const signer = createSigner(user);
  const dbEncryptionKey = getDbEncryptionKey(name);
  const xmtpEnv = (process.env.XMTP_ENV || "dev") as "dev" | "production";

  const agent = await Agent.create(signer, {
    env: xmtpEnv,
    dbPath: `.xmtp-db-${name}`,
    dbEncryptionKey,
  });

  console.log(`[${name}] XMTP agent online: ${agent.address}`);
  return { agent, name, groupId: null };
}

export async function createGroup(wireAgent: WireAgent, memberAddresses: string[]): Promise<string> {
  const group = await wireAgent.agent.createGroupWithAddresses(memberAddresses);
  wireAgent.groupId = group.id;
  console.log(`[${wireAgent.name}] Created XMTP group: ${group.id}`);
  return group.id;
}

export async function sendToGroup(wireAgent: WireAgent, msg: WireMessage): Promise<void> {
  if (!wireAgent.groupId) throw new Error("No group ID set");
  const conversations = await wireAgent.agent.client.conversations.list();
  const group = conversations.find((c) => c.id === wireAgent.groupId);
  if (!group) throw new Error("Group not found");
  await group.send(JSON.stringify(msg));
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
