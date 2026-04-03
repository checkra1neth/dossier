import { useState, useEffect, useCallback, useRef } from "react";

const AGENTS = ["scanner", "enricher", "analyst", "distributor", "trader"] as const;
type AgentName = (typeof AGENTS)[number];

export interface WireEvent {
  id: string;
  agent: AgentName;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

const MAX_EVENTS = 200;

export function useSSE(): {
  events: WireEvent[];
  getSignals: () => WireEvent[];
  getTrades: () => WireEvent[];
} {
  const [events, setEvents] = useState<WireEvent[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const sources: EventSource[] = [];

    for (const agent of AGENTS) {
      const url = `/agent/${agent}/events`;
      const es = new EventSource(url);

      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          const event: WireEvent = {
            id: `${agent}-${counterRef.current++}`,
            agent,
            type: parsed.type ?? "status",
            data: parsed,
            timestamp: Date.now(),
          };
          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        } catch {
          // ignore malformed
        }
      };

      es.onerror = () => {
        // silent reconnect handled by browser
      };

      sources.push(es);
    }

    return () => {
      for (const s of sources) s.close();
    };
  }, []);

  const getSignals = useCallback(
    () => events.filter((e) => e.type === "signal"),
    [events]
  );

  const getTrades = useCallback(
    () => events.filter((e) => e.type === "trade_result"),
    [events]
  );

  return { events, getSignals, getTrades };
}
