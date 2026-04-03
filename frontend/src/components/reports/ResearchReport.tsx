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
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
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

  const { data: d, analysis, address, timestamp } = data;
  const riskClass = `badge badge-${analysis.riskLevel === "medium" ? "med" : analysis.riskLevel}`;

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(address)} <span className="addr-full">{address}</span>
          </h2>
          <div className="badges">
            <span className={riskClass}>{analysis.riskLevel} risk</span>
            {d.isSmartMoney && <span className="badge badge-smart">Smart Money</span>}
          </div>
        </div>
        <span className="report-timestamp">{new Date(timestamp * 1000).toLocaleString()}</span>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Total Value</div>
          <div className="stat-value">{fmt(d.totalValueUsd)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{d.positionCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Chains</div>
          <div className="stat-value">{d.chains.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Top Asset</div>
          <div className="stat-value">{d.topPositions[0]?.asset ?? "N/A"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Risk</div>
          <div className="stat-value">{analysis.riskLevel.toUpperCase()}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">Analysis</h3>
          <div className="analysis-text">
            {analysis.summary.split("\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="verdict-box">
            <strong>Verdict</strong>
            {analysis.verdict}
          </div>
        </div>

        <div className="sidebar">
          <div>
            <h3 className="section-title">Top Allocations</h3>
            <ul className="alloc-list">
              {d.topPositions.map((pos, i) => (
                <li key={pos.asset} className="alloc-item">
                  <span className="alloc-asset">
                    <span className="alloc-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                    {pos.asset}
                  </span>
                  <span className="alloc-value">{fmt(pos.valueUsd)}</span>
                  <span className="alloc-pct">{pos.percentage.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="section-title">Patterns</h3>
            <div className="tag-list">
              {analysis.patterns.map((p) => (
                <span key={p} className="tag-item">{p}</span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="section-title">Chains</h3>
            <div className="chain-row">
              {d.chains.map((c) => (
                <span key={c} className="chain-tag">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
