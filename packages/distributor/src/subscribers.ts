export interface Subscriber {
  address: string;
  subscribedAt: number;
}

const subscribers = new Map<string, Subscriber>();

export function addSubscriber(address: string): boolean {
  const normalized = address.toLowerCase();
  if (subscribers.has(normalized)) return false;
  subscribers.set(normalized, { address: normalized, subscribedAt: Date.now() });
  return true;
}

export function removeSubscriber(address: string): boolean {
  return subscribers.delete(address.toLowerCase());
}

export function getSubscribers(): Subscriber[] {
  return Array.from(subscribers.values());
}

export function getSubscriberCount(): number {
  return subscribers.size;
}

export function isSubscribed(address: string): boolean {
  return subscribers.has(address.toLowerCase());
}
