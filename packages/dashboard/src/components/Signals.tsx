import type { WireEvent } from "../hooks/useSSE";

interface Props {
  signals: WireEvent[];
}

function actionColor(action: string): string {
  switch (action.toUpperCase()) {
    case "BUY":
      return "#22c55e";
    case "SELL":
      return "#ef4444";
    case "WATCH":
      return "#eab308";
    default:
      return "#888";
  }
}

export function Signals({ signals }: Props): JSX.Element {
  const rows = signals.slice(0, 20);

  return (
    <div className="panel">
      <h2 className="panel-title">Signals</h2>
      <div className="feed-scroll">
        <table className="signals-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Asset</th>
              <th>Conf%</th>
              <th>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const action = String(s.data.action ?? "WATCH");
              const asset = String(s.data.asset ?? "?");
              const confidence = String(s.data.confidence ?? "?");
              const reasoning = String(s.data.reasoning ?? "");
              return (
                <tr key={s.id}>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: actionColor(action),
                        color: "#000",
                      }}
                    >
                      {action.toUpperCase()}
                    </span>
                  </td>
                  <td className="mono">{asset}</td>
                  <td className="mono">{confidence}%</td>
                  <td className="reasoning-cell" title={reasoning}>
                    {reasoning.length > 60
                      ? reasoning.slice(0, 57) + "..."
                      : reasoning}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="feed-empty">
                  No signals yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
