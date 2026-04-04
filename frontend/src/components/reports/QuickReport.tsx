import { useRef, useState, useMemo } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface QuickData {
  address: string;
  portfolio: {
    totalValueUsd: number;
    chains: string[];
    change24hPercent: number;
    change24hUsd: number;
  };
  topPositions: {
    asset: string;
    valueUsd: number;
    percentage: number;
    name: string;
    quantity: number;
    chain: string;
  }[];
}

function fmt(n: number): string {
  const digits = Math.abs(n) < 1 ? 4 : Math.abs(n) < 100 ? 2 : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

function fmtQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.0001) return n.toFixed(4);
  return n.toExponential(2);
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

const DOT_COLORS = ["oklch(55% 0.15 250)", "oklch(55% 0.15 155)", "oklch(55% 0.12 25)", "oklch(55% 0.1 310)", "oklch(55% 0.1 75)"];

export function QuickReport({ data }: { data: QuickData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".alloc-item", { x: -12, autoAlpha: 0, duration: 0.4, stagger: 0.05, delay: 0.3, ease: "power3.out" });
    });
  }, { scope: ref });

  const { portfolio: p, topPositions, address } = data;
  const changeDir = p.change24hPercent >= 0 ? "up" : "down";

  const filteredPositions = useMemo(() => {
    const list = selectedChain
      ? topPositions.filter((pos) => pos.chain === selectedChain)
      : topPositions;
    return list.slice(0, 10);
  }, [topPositions, selectedChain]);

  const chainStats = useMemo(() => {
    const map = new Map<string, { count: number; totalValue: number }>();
    for (const pos of topPositions) {
      const entry = map.get(pos.chain) ?? { count: 0, totalValue: 0 };
      entry.count++;
      entry.totalValue += pos.valueUsd;
      map.set(pos.chain, entry);
    }
    return map;
  }, [topPositions]);

  const displayedTotal = selectedChain
    ? filteredPositions.reduce((s, pos) => s + pos.valueUsd, 0)
    : p.totalValueUsd;

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(address)} <span className="addr-full">{address}</span>
          </h2>
          <div className="badges">
            <span className={`badge badge-${changeDir === "up" ? "low" : "high"}`}>
              {fmtPct(p.change24hPercent)} 24h
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">{selectedChain ? `Value on ${selectedChain}` : "Total Value"}</div>
          <div className="stat-value">{fmt(displayedTotal)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">24h Change</div>
          <div className={`stat-value ${changeDir}`}>{fmtPct(p.change24hPercent)}</div>
          <div className="stat-sub">{fmt(p.change24hUsd)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Chains</div>
          <div className="stat-value">{p.chains.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Tokens{selectedChain ? ` (${selectedChain})` : ""}</div>
          <div className="stat-value">{selectedChain ? filteredPositions.length : topPositions.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Top Asset</div>
          <div className="stat-value">{filteredPositions[0]?.asset ?? "N/A"}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">
            Top Positions
            {selectedChain && (
              <button
                className="chain-clear"
                onClick={() => setSelectedChain(null)}
                type="button"
              >
                Show all
              </button>
            )}
          </h3>
          <ul className="alloc-list">
            {filteredPositions.map((pos, i) => (
              <li key={`${pos.asset}-${pos.chain}-${i}`} className="alloc-item">
                <span className="alloc-asset">
                  <span className="alloc-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                  {pos.name} ({pos.asset})
                </span>
                <span className="alloc-qty">{fmtQty(pos.quantity)}</span>
                <span className="alloc-value">{fmt(pos.valueUsd)}</span>
                <span className="alloc-pct">{pos.percentage.toFixed(1)}%</span>
              </li>
            ))}
            {filteredPositions.length === 0 && (
              <li className="alloc-item" style={{ opacity: 0.5 }}>No tokens on this chain</li>
            )}
          </ul>
        </div>

        <div className="sidebar">
          <div>
            <h3 className="section-title">Chains</h3>
            <div className="chain-row">
              {p.chains.map((c) => {
                const stats = chainStats.get(c);
                const isActive = selectedChain === c;
                return (
                  <button
                    key={c}
                    className={`chain-tag ${isActive ? "chain-tag-active" : ""}`}
                    onClick={() => setSelectedChain(isActive ? null : c)}
                    type="button"
                    title={stats ? `${stats.count} tokens, ${fmt(stats.totalValue)}` : c}
                  >
                    {c}
                    {stats && stats.count > 0 && (
                      <span className="chain-count">{stats.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
