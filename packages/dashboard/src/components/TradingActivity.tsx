import type { WireEvent } from "../hooks/useSSE";

interface Props {
  trades: WireEvent[];
}

const PLATFORM_ICONS: Record<string, string> = {
  polymarket: "🎲",
  hyperliquid: "💧",
  uniswap: "🦄",
  aave: "👻",
  default: "📊",
};

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "success" || s === "filled" || s === "executed") return "#22c55e";
  if (s === "failed" || s === "rejected" || s === "error") return "#ef4444";
  return "#eab308";
}

export function TradingActivity({ trades }: Props): JSX.Element {
  const items = trades.slice(0, 20);

  return (
    <div className="panel">
      <h2 className="panel-title">Trading Activity</h2>
      <div className="feed-scroll">
        {items.map((t) => {
          const platform = String(t.data.platform ?? "unknown");
          const action = String(t.data.action ?? "trade");
          const status = String(t.data.status ?? "pending");
          const icon =
            PLATFORM_ICONS[platform.toLowerCase()] ??
            PLATFORM_ICONS["default"];

          return (
            <div key={t.id} className="trade-item">
              <span className="trade-icon">{icon}</span>
              <span className="trade-platform">{platform}</span>
              <span className="trade-action">{action}</span>
              <span className="trade-sep">—</span>
              <span
                className="trade-status"
                style={{ color: statusColor(status) }}
              >
                {status}
              </span>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="feed-empty">No trades yet</div>
        )}
      </div>
    </div>
  );
}
