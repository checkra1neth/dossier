import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface NftPosition {
  name: string;
  collectionName: string;
  imageUrl: string | null;
  collectionIcon: string | null;
  valueUsd: number;
  chain: string;
  tokenId: string;
}

interface NftData {
  address: string;
  collections: {
    name: string;
    count: number;
    floorPrice: number;
    chain: string;
  }[];
  positions: NftPosition[];
  totalEstimatedUsd: number;
}

function fmt(n: number): string {
  const digits = Math.abs(n) < 1 ? 2 : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
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
      gsap.from(".nft-card", { y: 16, scale: 0.97, autoAlpha: 0, duration: 0.4, stagger: 0.05, delay: 0.2, ease: "power2.out" });
    });
  }, { scope: ref });

  const { collections, positions, totalEstimatedUsd, address } = data;
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

      {positions.length > 0 ? (
        <div className="nft-grid">
          {positions.map((nft) => (
            <div className="nft-card" key={`${nft.chain}-${nft.tokenId}`}>
              <div className="nft-img">
                {nft.imageUrl ? (
                  <img src={nft.imageUrl} alt={nft.name} loading="lazy" />
                ) : nft.collectionIcon ? (
                  <img src={nft.collectionIcon} alt={nft.collectionName} loading="lazy" />
                ) : (
                  <div className="nft-placeholder">NFT</div>
                )}
              </div>
              <div className="nft-info">
                <div className="nft-name">{nft.name}</div>
                <div className="nft-collection">{nft.collectionName}</div>
                <div className="nft-meta">
                  <span className="nft-value">{nft.valueUsd > 0 ? fmt(nft.valueUsd) : "—"}</span>
                  <span className="chain-tag">{nft.chain}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="empty-state"><p>No NFTs found</p></div>
      ) : (
        <table>
          <thead>
            <tr><th>Collection</th><th>Items</th><th>Floor</th><th>Chain</th></tr>
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
