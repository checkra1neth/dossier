import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface HistoryData {
  address: string;
  transactions: {
    type: string;
    timestamp: string;
    chain: string;
    transfers: {
      direction: string;
      symbol: string;
      quantity: number;
      valueUsd: number;
    }[];
  }[];
  pattern: {
    trades: number;
    receives: number;
    sends: number;
    executes: number;
    other: number;
  };
  frequency: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function txnClass(type: string): string {
  const t = type.toLowerCase();
  if (t === "trade") return "txn-type txn-trade";
  if (t === "receive") return "txn-type txn-receive";
  if (t === "send") return "txn-type txn-send";
  if (t === "execute") return "txn-type txn-execute";
  return "txn-type";
}

export function HistoryReport({ data }: { data: HistoryData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from("tbody tr", { y: 10, autoAlpha: 0, duration: 0.35, stagger: 0.04, delay: 0.2, ease: "power3.out" });
    });
  }, { scope: ref });

  const { transactions, pattern, frequency, address } = data;
  const total = pattern.trades + pattern.receives + pattern.sends + pattern.executes + pattern.other;

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(address)} <span className="addr-full">{address}</span>
          </h2>
          <div className="badges">
            <span className="badge badge-smart">{frequency}</span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Total Txns</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Trades</div>
          <div className="stat-value">{pattern.trades}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Receives</div>
          <div className="stat-value">{pattern.receives}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Sends</div>
          <div className="stat-value">{pattern.sends}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Executes</div>
          <div className="stat-value">{pattern.executes}</div>
        </div>
      </div>

      <div className="txn-header">
        <h3>Recent Transactions</h3>
        <span>{transactions.length} shown</span>
      </div>
      {transactions.length === 0 ? (
        <div className="empty-state"><p>No transactions found</p></div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Time</th>
              <th>Chain</th>
              <th>Transfers</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => {
              const totalVal = tx.transfers.reduce((s, t) => s + t.valueUsd, 0);
              return (
                <tr key={`${tx.timestamp}-${i}`}>
                  <td><span className={txnClass(tx.type)}>{tx.type}</span></td>
                  <td className="mono">{new Date(tx.timestamp).toLocaleDateString()}</td>
                  <td><span className="chain-tag">{tx.chain}</span></td>
                  <td className="mono">
                    {tx.transfers.map((t, j) => (
                      <span key={j}>
                        {t.direction === "in" ? "+" : "-"}{t.quantity.toFixed(4)} {t.symbol}
                        {j < tx.transfers.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </td>
                  <td className="mono">{fmt(totalVal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
