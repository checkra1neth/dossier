import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface BalanceData {
  wallet: string;
  address: string;
  positions: {
    asset: string;
    name: string;
    valueUsd: number;
    quantity: number;
    chain: string;
    percentage: number;
  }[];
  totalUsd: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

const DOT_COLORS = ["oklch(55% 0.15 250)", "oklch(55% 0.15 155)", "oklch(55% 0.12 25)", "oklch(55% 0.1 310)", "oklch(55% 0.1 75)"];

export function BalanceReport({ data }: { data: BalanceData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".alloc-item", { x: -12, autoAlpha: 0, duration: 0.4, stagger: 0.05, delay: 0.3, ease: "power3.out" });
    });
  }, { scope: ref });

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {data.wallet || shortAddr(data.address)} <span className="addr-full">{data.address}</span>
          </h2>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Total Value</div>
          <div className="stat-value">{fmt(data.totalUsd)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{data.positions.length}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">Positions</h3>
          <ul className="alloc-list">
            {data.positions.map((pos, i) => (
              <li key={`${pos.asset}-${pos.chain}`} className="alloc-item">
                <span className="alloc-asset">
                  <span className="alloc-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                  {pos.name} ({pos.asset})
                </span>
                <span className="alloc-value">{fmt(pos.valueUsd)}</span>
                <span className="alloc-pct">{pos.percentage.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar">
          <div>
            <h3 className="section-title">Chains</h3>
            <div className="chain-row">
              {[...new Set(data.positions.map((p) => p.chain))].map((c) => (
                <span key={c} className="chain-tag">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
