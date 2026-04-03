import { useRef, useState, useMemo } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface Position {
  protocol: string;
  type: string;
  asset: string;
  valueUsd: number;
  chain: string;
}

interface DefiData {
  address: string;
  positions: Position[];
  totalDefiUsd: number;
}

function fmt(n: number): string {
  const digits = Math.abs(n) < 1 ? 2 : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function DefiReport({ data }: { data: DefiData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [activeChain, setActiveChain] = useState<string | null>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".defi-item", { x: -12, autoAlpha: 0, duration: 0.4, stagger: 0.05, delay: 0.2, ease: "power3.out" });
    });
  }, { scope: ref });

  // Filter out zero-value on frontend too
  const nonZero = useMemo(() => data.positions.filter((p) => p.valueUsd > 0), [data.positions]);
  const chains = useMemo(() => [...new Set(nonZero.map((p) => p.chain))], [nonZero]);

  const filtered = useMemo(() => {
    if (!activeChain) return nonZero;
    return nonZero.filter((p) => p.chain === activeChain);
  }, [nonZero, activeChain]);

  const filteredTotal = useMemo(() => filtered.reduce((s, p) => s + p.valueUsd, 0), [filtered]);
  const protocols = useMemo(() => [...new Set(filtered.map((p) => p.protocol))], [filtered]);

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(data.address)} <span className="addr-full">{data.address}</span>
          </h2>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat">
          <div className="stat-label">{activeChain ? `${activeChain} DeFi` : "Total DeFi Value"}</div>
          <div className="stat-value">{fmt(activeChain ? filteredTotal : data.totalDefiUsd)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{filtered.length}{activeChain ? ` / ${nonZero.length}` : ""}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Protocols</div>
          <div className="stat-value">{protocols.length}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">DeFi Positions{activeChain ? ` · ${activeChain}` : ""}</h3>
          {filtered.length === 0 ? (
            <div className="empty-state"><p>No DeFi positions{activeChain ? ` on ${activeChain}` : ""}</p></div>
          ) : (
            <ul className="defi-list">
              {filtered.map((pos, i) => (
                <li key={`${pos.protocol}-${pos.asset}-${pos.chain}-${i}`} className="defi-item">
                  <div>
                    <span className="defi-proto">{pos.protocol}</span>
                    <span className="defi-type"> / {pos.type}</span>
                    <div className="mono">{pos.asset} on {pos.chain}</div>
                  </div>
                  <span className="defi-val">{fmt(pos.valueUsd)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sidebar">
          <div>
            <h3 className="section-title">Chains</h3>
            <div className="chain-row">
              {chains.map((c) => (
                <button
                  key={c}
                  className={`chain-tag chain-btn${activeChain === c ? " chain-active" : ""}`}
                  onClick={() => setActiveChain((prev) => prev === c ? null : c)}
                  type="button"
                >
                  {c}
                </button>
              ))}
              {activeChain && (
                <button className="chain-tag chain-btn chain-clear" onClick={() => setActiveChain(null)} type="button">All</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
