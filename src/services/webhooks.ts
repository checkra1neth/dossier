/**
 * Zerion webhook subscription service for wallet monitoring.
 *
 * Manages tx-subscription lifecycle via Zerion API and tracks
 * which XMTP conversation to notify when activity is detected.
 *
 * NOTE: In-memory storage — watches are lost on restart (acceptable for MVP).
 */

const ZERION_BASE = "https://api.zerion.io/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WatchEntry {
  address: string;
  subscriptionId: string;
  conversationId: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// In-memory store: lowercase address -> WatchEntry
// ---------------------------------------------------------------------------

const watchList = new Map<string, WatchEntry>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.ZERION_API_KEY;
  if (!key) throw new Error("ZERION_API_KEY is not set");
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${getApiKey()}:`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function getCallbackUrl(): string {
  return process.env.WEBHOOK_URL ?? "http://localhost:4000/webhook";
}

// ---------------------------------------------------------------------------
// Zerion tx-subscriptions API
// ---------------------------------------------------------------------------

interface ZerionSubscriptionResponse {
  data: {
    id: string;
  };
}

async function zerionCreateSubscription(address: string): Promise<string> {
  const url = `${ZERION_BASE}/tx-subscriptions`;
  const body = {
    callback_url: getCallbackUrl(),
    addresses: [address.toLowerCase()],
    chain_ids: ["ethereum", "base", "optimism", "arbitrum", "polygon"],
  };

  console.log(`[webhooks] Creating Zerion subscription for ${address} -> ${getCallbackUrl()}`);

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zerion create subscription failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as ZerionSubscriptionResponse;
  const subscriptionId = json.data.id;
  console.log(`[webhooks] Subscription created: ${subscriptionId}`);
  return subscriptionId;
}

async function zerionDeleteSubscription(subscriptionId: string): Promise<void> {
  const url = `${ZERION_BASE}/tx-subscriptions/${subscriptionId}`;

  console.log(`[webhooks] Deleting Zerion subscription ${subscriptionId}`);

  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Zerion delete subscription failed (${res.status}): ${text}`);
  }

  console.log(`[webhooks] Subscription ${subscriptionId} deleted`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Zerion webhook subscription for a wallet address and
 * associate it with an XMTP conversation for notifications.
 */
export async function createWatch(
  address: string,
  conversationId: string,
): Promise<WatchEntry> {
  const key = address.toLowerCase();

  // If already watching this address, return existing entry
  const existing = watchList.get(key);
  if (existing) {
    console.log(`[webhooks] Already watching ${address} (subscription: ${existing.subscriptionId})`);
    return existing;
  }

  const subscriptionId = await zerionCreateSubscription(address);

  const entry: WatchEntry = {
    address: key,
    subscriptionId,
    conversationId,
    createdAt: Date.now(),
  };

  watchList.set(key, entry);
  console.log(`[webhooks] Watch created: ${key} -> conversation ${conversationId}`);
  return entry;
}

/**
 * Remove a watch — deletes the Zerion subscription and removes from store.
 */
export async function removeWatch(address: string): Promise<boolean> {
  const key = address.toLowerCase();
  const entry = watchList.get(key);

  if (!entry) {
    console.log(`[webhooks] No watch found for ${address}`);
    return false;
  }

  await zerionDeleteSubscription(entry.subscriptionId);
  watchList.delete(key);
  console.log(`[webhooks] Watch removed: ${key}`);
  return true;
}

/**
 * List all active watches.
 */
export function listWatches(): WatchEntry[] {
  return Array.from(watchList.values());
}

/**
 * Get a watch entry by address.
 */
export function getWatch(address: string): WatchEntry | undefined {
  return watchList.get(address.toLowerCase());
}
