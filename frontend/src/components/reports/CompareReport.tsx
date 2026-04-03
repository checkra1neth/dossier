import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface WalletData {
  portfolio: {
    totalValueUsd: number;
    chains: string[];
    change24hPercent: number;
    change24hUsd: number;
  };
  positions: { asset: string; valueUsd: number; percentage: number }[];
  pnl: {
    realizedGain: number;
    unrealizedGain: number;
    totalFees: number;
    netInvested: number;
  };
}

interface CompareData {
  addressA: string;
  addressB: string;
  a: WalletData;
  b: WalletData;
  verdict: string;
}

function fmt(n: number): string {
  const digits = Math.abs(n) < 1 ? 4 : Math.abs(n) < 100 ? 2 : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function WalletColumn({ label, addr, w }: { label: string; addr: string; w: WalletData }): ReactNode {
  const gain = w.pnl.realizedGain + w.pnl.unrealizedGain;
  return (
    <div>
      <h3 className="section-title">{label}: {shortAddr(addr)}</h3>
      <div className="pnl-grid">
        <div className="pnl-item">
          <div className="l">Portfolio</div>
          <div className="v">{fmt(w.portfolio.totalValueUsd)}</div>
        </div>
        <div className="pnl-item">
          <div className="l">24h Change</div>
          <div className={`v ${w.portfolio.change24hPercent >= 0 ? "up" : "down"}`}>
            {fmtPct(w.portfolio.change24hPercent)}
          </div>
        </div>
        <div className="pnl-item">
          <div className="l">Net PnL</div>
          <div className={`v ${gain >= 0 ? "up" : "down"}`}>{fmt(gain)}</div>
        </div>
        <div className="pnl-item">
          <div className="l">Fees</div>
          <div className="v down">{fmt(w.pnl.totalFees)}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <h3 className="section-title">Top Positions</h3>
        <ul className="alloc-list">
          {w.positions.slice(0, 5).map((pos) => (
            <li key={pos.asset} className="alloc-item">
              <span className="alloc-asset">{pos.asset}</span>
              <span className="alloc-value">{fmt(pos.valueUsd)}</span>
              <span className="alloc-pct">{pos.percentage.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="chain-row">
          {w.portfolio.chains.map((c) => (
            <span key={c} className="chain-tag">{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompareReport({ data }: { data: CompareData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".pnl-item", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" });
      gsap.from(".verdict-box", { y: 20, autoAlpha: 0, duration: 0.6, delay: 0.3, ease: "power3.out" });
    });
  }, { scope: ref });

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>Wallet Comparison</h2>
          <div className="badges">
            <span className="badge badge-smart">{shortAddr(data.addressA)}</span>
            <span className="badge badge-med">vs</span>
            <span className="badge badge-smart">{shortAddr(data.addressB)}</span>
          </div>
        </div>
      </div>

      <div className="report-body" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <WalletColumn label="Wallet A" addr={data.addressA} w={data.a} />
        <WalletColumn label="Wallet B" addr={data.addressB} w={data.b} />
      </div>

      <div className="verdict-box" style={{ marginTop: 28 }}>
        <strong>Verdict</strong>
        {data.verdict}
      </div>
    </div>
  );
}
