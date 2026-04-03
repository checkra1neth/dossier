import type { WireEvent } from "../hooks/useSSE";

interface Props {
  events: WireEvent[];
}

const AGENT_COLORS: Record<string, string> = {
  scanner: "#3b82f6",
  enricher: "#a855f7",
  analyst: "#eab308",
  distributor: "#22c55e",
  trader: "#ef4444",
};

function summarize(event: WireEvent): string {
  const d = event.data as Record<string, any>;
  switch (event.type) {
    case "raw_event":
      return `Whale: $${Number(d.valueUsd ?? 0).toLocaleString()} ${d.type ?? ""} from ${String(d.from ?? "").slice(0, 10)}...`;
    case "enriched_event": {
      const wp = d.walletProfile ?? {};
      return `Portfolio: $${Number(wp.totalValueUsd ?? 0).toLocaleString()}, Smart money: ${wp.isSmartMoney ?? false}`;
    }
    case "signal":
      return `${d.action ?? "WATCH"} ${d.asset ?? "?"} — ${d.confidence ?? "?"}% — ${String(d.reasoning ?? "").slice(0, 80)}`;
    case "trade_result":
      return `[${d.platform ?? "?"}] ${String(d.action ?? "").slice(0, 60)} — ${d.status ?? "pending"}`;
    case "status":
      return String(d.message ?? JSON.stringify(d)).slice(0, 100);
    default:
      return JSON.stringify(d).slice(0, 120);
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveFeed({ events }: Props): JSX.Element {
  return (
    <div className="panel">
      <h2 className="panel-title">Live XMTP Feed</h2>
      <div className="feed-scroll">
        {events.map((e) => (
          <div key={e.id} className="feed-item">
            <span className="feed-time">{formatTime(e.timestamp)}</span>
            <span
              className="feed-agent"
              style={{ color: AGENT_COLORS[e.agent] ?? "#888" }}
            >
              [{e.agent}]
            </span>
            <span className="feed-text">{summarize(e)}</span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="feed-empty">Waiting for agent events...</div>
        )}
      </div>
    </div>
  );
}
