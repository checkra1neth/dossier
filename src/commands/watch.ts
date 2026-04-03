/**
 * /watch and /unwatch command handlers.
 *
 * Creates/removes Zerion webhook subscriptions and returns
 * human-readable confirmation text for XMTP.
 */

import { createWatch, removeWatch, listWatches, getWatch } from "../services/webhooks.ts";

/**
 * Handle /watch command — create a webhook subscription for the given address.
 */
export async function handleWatch(
  address: string,
  conversationId: string,
): Promise<string> {
  console.log(`[watch] /watch ${address}`);

  const existing = getWatch(address);
  if (existing) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const ago = Math.round((Date.now() - existing.createdAt) / 60_000);
    return (
      `Already watching ${short}\n` +
      `Set up ${ago} min ago.\n\n` +
      `Use /unwatch ${address} to stop.`
    );
  }

  const entry = await createWatch(address, conversationId);
  const short = `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;
  const total = listWatches().length;

  return (
    `\u{1F441} Now watching ${short}\n` +
    `Chains: ethereum, base, optimism, arbitrum, polygon\n\n` +
    `You'll receive alerts here when this wallet makes transactions.\n` +
    `Active watches: ${total}\n\n` +
    `Use /unwatch ${address} to stop.`
  );
}

/**
 * Handle /unwatch command — remove the webhook subscription.
 */
export async function handleUnwatch(address: string): Promise<string> {
  console.log(`[watch] /unwatch ${address}`);

  const removed = await removeWatch(address);

  if (!removed) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return `Not watching ${short}. Nothing to unwatch.`;
  }

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const remaining = listWatches().length;

  return (
    `Stopped watching ${short}\n` +
    `Active watches: ${remaining}`
  );
}
