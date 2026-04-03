import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface DefiData {
  address: string;
  positions: {
    protocol: string;
    type: string;
    asset: string;
    valueUsd: number;
    chain: string;
  }[];
  totalDefiUsd: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function DefiReport({ data }: { data: DefiData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".defi-item", { x: -12, autoAlpha: 0, duration: 0.4, stagger: 0.05, delay: 0.2, ease: "power3.out" });
    });
  }, { scope: ref });

  const { positions, totalDefiUsd, address } = data;
  const chains = [...new Set(positions.map((p) => p.chain))];
  const protocols = [...new Set(positions.map((p) => p.protocol))];

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(address)} <span className="addr-full">{address}</span>
          </h2>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat">
          <div className="stat-label">Total DeFi Value</div>
          <div className="stat-value">{fmt(totalDefiUsd)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{positions.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Protocols</div>
          <div className="stat-value">{protocols.length}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">DeFi Positions</h3>
          {positions.length === 0 ? (
            <div className="empty-state"><p>No DeFi positions found</p></div>
          ) : (
            <ul className="defi-list">
              {positions.map((pos, i) => (
                <li key={`${pos.protocol}-${pos.asset}-${i}`} className="defi-item">
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
                <span key={c} className="chain-tag">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
