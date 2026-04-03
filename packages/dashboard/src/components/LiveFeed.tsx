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
  const d = event.data;
  switch (event.type) {
    case "raw_event":
      return `Whale movement: ${d.amount ?? "unknown"} ${d.token ?? d.asset ?? ""}`;
    case "enriched_event":
      return `Portfolio: ${d.portfolio ?? "?"}, Smart money: ${d.smartMoney ?? d.smart_money ?? "N/A"}`;
    case "signal":
      return `${d.action ?? "WATCH"} ${d.asset ?? "?"} — confidence ${d.confidence ?? "?"}%: ${d.reasoning ?? ""}`;
    case "trade_result":
      return `[${d.platform ?? "?"}] ${d.action ?? "?"} — ${d.status ?? "pending"}`;
    case "status":
      return String(d.message ?? d.status ?? JSON.stringify(d));
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
