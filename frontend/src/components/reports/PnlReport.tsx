import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface PnlData {
  address: string;
  pnl: {
    realizedGain: number;
    unrealizedGain: number;
    totalFees: number;
    netInvested: number;
  };
  roi: number;
}

function fmt(n: number): string {
  const digits = Math.abs(n) < 1 ? 4 : Math.abs(n) < 100 ? 2 : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

function fmtPct(n: number): string {
  const clamped = Math.max(-9999, Math.min(9999, n));
  const abs = Math.abs(clamped);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${n >= 0 ? "+" : ""}${clamped.toFixed(digits)}%`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function PnlReport({ data }: { data: PnlData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".pnl-item", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
    });
  }, { scope: ref });

  const { pnl, roi, address } = data;
  const totalGain = pnl.realizedGain + pnl.unrealizedGain;
  const roiDir = roi >= 0 ? "up" : "down";

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(address)} <span className="addr-full">{address}</span>
          </h2>
          <div className="badges">
            <span className={`badge badge-${roi >= 0 ? "low" : "high"}`}>
              ROI {fmtPct(roi)}
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat">
          <div className="stat-label">Net PnL</div>
          <div className={`stat-value ${totalGain >= 0 ? "up" : "down"}`}>{fmt(totalGain)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Net Invested</div>
          <div className="stat-value">{fmt(pnl.netInvested)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">ROI</div>
          <div className={`stat-value ${roiDir}`}>{fmtPct(roi)}</div>
        </div>
      </div>

      <h3 className="section-title">Breakdown</h3>
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
          <div className="l">Total Fees</div>
          <div className="v down">{fmt(pnl.totalFees)}</div>
        </div>
        <div className="pnl-item">
          <div className="l">Net Invested</div>
          <div className="v">{fmt(pnl.netInvested)}</div>
        </div>
      </div>
    </div>
  );
}
