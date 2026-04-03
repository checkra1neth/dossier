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

interface SendData {
  request: {
    amount: number;
    symbol: string;
    toAddress: string;
    chain: string;
  };
  fromAddress: string;
  token: TokenInfo;
  status: "pending_confirm" | "executed" | "failed";
  txResult?: string;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
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

export function SendReport({ data }: { data: SendData }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".stat", { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" });
      gsap.from(".token-info", { y: 12, autoAlpha: 0, duration: 0.4, delay: 0.3, ease: "power3.out" });
    });
  }, { scope: ref });

  const { request, token } = data;

  return (
    <div ref={ref}>
      <div className="report-top">
        <div className="report-wallet">
          <h2>Send: {request.amount} {request.symbol}</h2>
          <div className="badges">
            <span className={`status-badge ${statusClass(data.status)}`}>
              {statusLabel(data.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-label">Amount</div>
          <div className="stat-value">{request.amount} {request.symbol}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Value</div>
          <div className="stat-value">{fmtUsd(request.amount * token.price)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Recipient</div>
          <div className="stat-value mono" style={{ fontSize: "0.85rem" }}>{shortAddr(request.toAddress)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Chain</div>
          <div className="stat-value">{request.chain}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Token Price</div>
          <div className="stat-value">{fmtUsd(token.price)}</div>
        </div>
      </div>

      <div className="report-body">
        <div>
          <h3 className="section-title">Token Details</h3>
          <div className="token-info">
            <div className="token-detail">
              <strong>{token.name} ({token.symbol})</strong>
              Chain: {token.chain} &middot; Decimals: {token.decimals}
            </div>
            <div className="token-detail">
              <strong>Contract</strong>
              <span className="mono">{token.address}</span>
            </div>
          </div>
          {data.txResult && (
            <div className="verdict-box" style={{ marginTop: 16 }}>
              <strong>Transaction Result</strong>
              <span className="mono">{data.txResult}</span>
            </div>
          )}
        </div>

        <div className="sidebar">
          <div>
            <h3 className="section-title">Addresses</h3>
            <div className="tag-list">
              <div className="tag-item"><strong>From:</strong> <span className="mono">{data.fromAddress}</span></div>
              <div className="tag-item"><strong>To:</strong> <span className="mono">{request.toAddress}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
