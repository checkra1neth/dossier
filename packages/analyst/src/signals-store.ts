import type { Signal } from "@wire/shared/types";

const MAX_SIGNALS = 1000;
const signals: Signal[] = [];

export function addSignal(signal: Signal): void {
  signals.unshift(signal);
  if (signals.length > MAX_SIGNALS) {
    signals.length = MAX_SIGNALS;
  }
}

export function getLatestSignal(): Signal | null {
  return signals[0] ?? null;
}

export function getSignals(limit: number = 50): Signal[] {
  return signals.slice(0, limit);
}
