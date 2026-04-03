/**
 * /subscribe and /unsubscribe command handlers for daily digest.
 *
 * MVP stub — stores conversation IDs that opted in for daily digests.
 * Actual delivery (cron-based) is a future enhancement.
 */

// In-memory set of conversation IDs subscribed to daily digest
const digestSubscribers = new Set<string>();

/**
 * Subscribe a conversation to the daily digest.
 */
export function handleSubscribe(conversationId: string): string {
  console.log(`[subscribe] /subscribe ${conversationId}`);

  if (digestSubscribers.has(conversationId)) {
    return (
      `You're already subscribed to the daily digest.\n\n` +
      `Use /unsubscribe to stop.`
    );
  }

  digestSubscribers.add(conversationId);
  const total = digestSubscribers.size;

  return (
    `\u{1F4EC} Subscribed to daily digest!\n\n` +
    `You'll receive a daily summary of notable on-chain activity.\n` +
    `(Coming soon — digest delivery is under development)\n\n` +
    `Subscribers: ${total}\n` +
    `Use /unsubscribe to stop.`
  );
}

/**
 * Unsubscribe a conversation from the daily digest.
 */
export function handleUnsubscribe(conversationId: string): string {
  console.log(`[subscribe] /unsubscribe ${conversationId}`);

  const removed = digestSubscribers.delete(conversationId);

  if (!removed) {
    return `You're not subscribed. Use /subscribe to opt in.`;
  }

  return `Unsubscribed from daily digest.`;
}

/**
 * Get all conversation IDs subscribed to the daily digest.
 */
export function getDigestSubscribers(): string[] {
  return Array.from(digestSubscribers);
}
