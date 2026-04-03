import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chain: string;
  price: number;
}

interface BridgeData {
  offer: {
    source: string;
    outputQuantity: string;
    outputSymbol: string;
    gas: number;
    slippage: string;
    transaction: {
      to: string;
      from: string;
      chainId: string;
      gas: number;
      data: string;
      value: string;
    };
  };
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  txHash?: string;
  status: "pending_confirm" | "executed" | "failed";
}

function statusClass(s: string): string {
  if (s === "executed") return "status-executed";
  if (s === "failed") return "status-failed";
  return "status-pending";
}

function statusLabel(s: string): string {
  if (s === "pending_confirm") return "Pending Confirmation";
  if (s === "executed") return "Executed";
  return "Failed";
}

export function BridgeReport({ data }: { data: BridgeData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".token-info", { y: 12, autoAlpha: 0, duration: 0.4, delay: 0.3, ease: "power3.out" });
    });
  }, { scope: ref });

  const { offer, inputToken, outputToken } = data;

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>Bridge: {inputToken.chain} &rarr; {outputToken.chain}</h2>
          <div className="badges">
            <span className={`status-badge ${statusClass(data.status)}`}>
              {statusLabel(data.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Token</div>
          <div className="stat-value">{inputToken.symbol}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Output</div>
          <div className="stat-value">{offer.outputQuantity} {offer.outputSymbol}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Source</div>
          <div className="stat-value">{offer.source}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Gas</div>
          <div className="stat-value">{offer.gas.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Slippage</div>
          <div className="stat-value">{offer.slippage}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">Bridge Details</h3>
          <div className="token-info">
            <div className="token-detail">
              <strong>From: {inputToken.name} ({inputToken.chain})</strong>
              Address: <span className="mono">{inputToken.address}</span>
            </div>
            <div className="token-detail">
              <strong>To: {outputToken.name} ({outputToken.chain})</strong>
              Address: <span className="mono">{outputToken.address}</span>
            </div>
          </div>
          {data.txHash && (
            <div className="verdict-box" style={{ marginTop: 16 }}>
              <strong>Transaction Hash</strong>
              <span className="mono">{data.txHash}</span>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div>
            <h3 className="section-title">Transaction</h3>
            <div className="tag-list">
              <div className="tag-item"><strong>From:</strong> <span className="mono">{offer.transaction.from}</span></div>
              <div className="tag-item"><strong>To:</strong> <span className="mono">{offer.transaction.to}</span></div>
              <div className="tag-item"><strong>Chain ID:</strong> {offer.transaction.chainId}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
