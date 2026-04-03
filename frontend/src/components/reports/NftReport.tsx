import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface NftData {
  address: string;
  collections: {
    name: string;
    count: number;
    floorPrice: number;
    chain: string;
  }[];
  totalEstimatedUsd: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function NftReport({ data }: { data: NftData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from("tbody tr", { y: 10, autoAlpha: 0, duration: 0.35, stagger: 0.04, delay: 0.2, ease: "power3.out" });
    });
  }, { scope: ref });

  const { collections, totalEstimatedUsd, address } = data;
  const totalItems = collections.reduce((s, c) => s + c.count, 0);
  const chains = [...new Set(collections.map((c) => c.chain))];

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>
            {shortAddr(address)} <span className="addr-full">{address}</span>
          </h2>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat">
          <div className="stat-label">Estimated Value</div>
          <div className="stat-value">{fmt(totalEstimatedUsd)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Collections</div>
          <div className="stat-value">{collections.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{totalItems}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Chains</div>
          <div className="stat-value">{chains.length}</div>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="empty-state"><p>No NFT collections found</p></div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Collection</th>
              <th>Items</th>
              <th>Floor Price</th>
              <th>Chain</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((col) => (
              <tr key={`${col.name}-${col.chain}`}>
                <td><strong>{col.name}</strong></td>
                <td className="mono">{col.count}</td>
                <td className="mono">{fmt(col.floorPrice)}</td>
                <td><span className="chain-tag">{col.chain}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
