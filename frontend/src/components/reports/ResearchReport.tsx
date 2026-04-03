import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface ResearchData {
  address: string;
  timestamp: number;
  data: {
    totalValueUsd: number;
    chains: string[];
    topPositions: { asset: string; valueUsd: number; percentage: number }[];
    isSmartMoney: boolean;
    positionCount: number;
  };
  analysis: {
    summary: string;
    riskLevel: "low" | "medium" | "high";
    patterns: string[];
    verdict: string;
  };
  defi?: { protocol: string; type: string; asset: string; valueUsd: number; chain: string }[];
  pnl?: { realizedGain: number; unrealizedGain: number; totalFees: number; netInvested: number } | null;
  transactions?: { type: string; timestamp: string; chain: string; transfers: { direction: string; symbol: string; quantity: number; valueUsd: number }[] }[];
  portfolio?: { totalValueUsd: number; chains: string[]; change24hPercent: number; change24hUsd: number };
}

function fmt(n: number): string {
  const digits = Math.abs(n) < 1 ? 4 : Math.abs(n) < 100 ? 2 : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function txnClass(type: string): string {
  const t = type.toLowerCase();
  if (t === "trade") return "txn-type txn-trade";
  if (t === "receive") return "txn-type txn-receive";
  if (t === "send") return "txn-type txn-send";
  return "txn-type txn-execute";
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const DOT_COLORS = ["oklch(55% 0.15 250)", "oklch(55% 0.15 155)", "oklch(55% 0.12 25)", "oklch(55% 0.1 310)", "oklch(55% 0.1 75)"];

export function ResearchReport({ data }: { data: ResearchData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".report-body > *", { y: 20, autoAlpha: 0, duration: 0.6, stagger: 0.1, delay: 0.2, ease: "power3.out" });
    });
  }, { scope: ref });

  const { data: d, analysis, address, timestamp, defi, pnl, transactions, portfolio } = data;
  const riskClass = `badge badge-${analysis.riskLevel === "medium" ? "med" : analysis.riskLevel}`;
  const totalDefi = defi?.reduce((s, p) => s + p.valueUsd, 0) ?? 0;
  const roi = pnl && pnl.netInvested > 0 ? ((pnl.realizedGain + pnl.unrealizedGain) / pnl.netInvested) * 100 : 0;

  return (
    <div ref={ref}>
      {/* Header */}
      <div className="report-top">
        <div className="report-wallet">
          <h2>{shortAddr(address)} <span className="addr-full">{address}</span></h2>
          <div className="badges">
            <span className={riskClass}>{analysis.riskLevel} risk</span>
            {d.isSmartMoney && <span className="badge badge-smart">Smart Money</span>}
          </div>
        </div>
        <span className="report-timestamp">{new Date(timestamp).toLocaleString()}</span>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Portfolio</div>
          <div className="stat-value">{fmtK(d.totalValueUsd)}</div>
          <div className="stat-sub">across {d.chains.length} chains</div>
        </div>
        <div className="stat">
          <div className="stat-label">24h Change</div>
          <div className={`stat-value ${(portfolio?.change24hPercent ?? 0) >= 0 ? "up" : "down"}`}>
            {fmtPct(portfolio?.change24hPercent ?? 0)}
          </div>
          <div className="stat-sub">{fmt(portfolio?.change24hUsd ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">ROI</div>
          <div className={`stat-value ${roi >= 0 ? "up" : "down"}`}>{fmtPct(roi)}</div>
          <div className="stat-sub">net invested {fmtK(pnl?.netInvested ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">DeFi Deployed</div>
          <div className="stat-value">{fmtK(totalDefi)}</div>
          <div className="stat-sub">{defi?.length ?? 0} positions</div>
        </div>
        <div className="stat">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{d.positionCount}</div>
        </div>
      </div>

      {/* Body: Analysis + Sidebar */}
      <div className="report-body">
        <div>
          {/* Analysis */}
          <h3 className="section-title">Analysis</h3>
          <div className="analysis-text">
            {analysis.summary.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>

          {/* PnL */}
          {pnl && (
            <>
              <h3 className="section-title" style={{ marginTop: 24 }}>Profit &amp; Loss</h3>
              <div className="pnl-grid">
                <div className="pnl-item">
                  <div className="l">Realized Gain</div>
                  <div className={`v ${pnl.realizedGain >= 0 ? "up" : "down"}`}>{fmt(pnl.realizedGain)}</div>
                </div>
                <div className="pnl-item">
                  <div className="l">Unrealized Gain</div>
                  <div className={`v ${pnl.unrealizedGain >= 0 ? "up" : "down"}`}>{fmt(pnl.unrealizedGain)}</div>
                </div>
                <div className="pnl-item">
                  <div className="l">Net Invested</div>
                  <div className="v">{fmt(pnl.netInvested)}</div>
                </div>
                <div className="pnl-item">
                  <div className="l">Total Fees</div>
                  <div className="v down">{fmt(pnl.totalFees)}</div>
                </div>
              </div>
            </>
          )}

          {/* Verdict */}
          <div className="verdict-box" style={{ marginTop: 20 }}>
            <strong>Verdict</strong>
            {analysis.verdict}
          </div>

          {/* Transactions */}
          {transactions && transactions.length > 0 && (
            <>
              <div className="txn-header" style={{ marginTop: 28 }}>
                <h3>Recent transactions</h3>
              </div>
              <table>
                <thead>
                  <tr><th>Type</th><th>Details</th><th>Chain</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={`${tx.timestamp}-${i}`}>
                      <td><span className={txnClass(tx.type)}>{tx.type}</span></td>
                      <td className="mono">
                        {tx.transfers.map((t, j) => (
                          <span key={j}>
                            {t.direction === "in" ? "+" : ""}{t.quantity.toFixed(t.quantity < 1 ? 4 : 2)} {t.symbol}
                            {j < tx.transfers.length - 1 ? " → " : ""}
                          </span>
                        ))}
                      </td>
                      <td><span className="chain-tag">{tx.chain}</span></td>
                      <td className="mono">{timeAgo(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Allocation */}
          <div>
            <h3 className="section-title">Allocation</h3>
            <ul className="alloc-list">
              {d.topPositions.slice(0, 6).map((pos, i) => (
                <li key={pos.asset} className="alloc-item">
                  <span className="alloc-asset">
                    <span className="alloc-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                    {pos.asset}
                  </span>
                  <span className="alloc-value">{fmtK(pos.valueUsd)}</span>
                  <span className="alloc-pct">{pos.percentage.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>

          {/* DeFi Positions */}
          {defi && defi.length > 0 && (
            <div>
              <h3 className="section-title">DeFi Positions</h3>
              <ul className="defi-list">
                {defi.slice(0, 5).map((pos, i) => (
                  <li key={`${pos.protocol}-${pos.asset}-${i}`} className="defi-item">
                    <div>
                      <span className="defi-proto">{pos.protocol}</span>
                      <span className="defi-type">{pos.type} · {pos.asset}</span>
                    </div>
                    <span className="defi-val">{fmtK(pos.valueUsd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Patterns */}
          {analysis.patterns.length > 0 && (
            <div>
              <h3 className="section-title">Detected Patterns</h3>
              <div className="tag-list">
                {analysis.patterns.map((p) => <span key={p} className="tag-item">{p}</span>)}
              </div>
            </div>
          )}

          {/* Chains */}
          <div>
            <h3 className="section-title">Active Chains</h3>
            <div className="chain-row">
              {d.chains.slice(0, 8).map((c) => <span key={c} className="chain-tag">{c}</span>)}
              {d.chains.length > 8 && <span className="chain-tag">+{d.chains.length - 8}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
