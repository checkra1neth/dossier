import type { ReactNode } from "react";

export function ReportPreview(): ReactNode {
  return (
    <div className="report-card">
      <div className="report-header">
        <span>Deep Research Report</span>
        <div className="report-live" />
      </div>
      <div className="report-body">
        <div className="report-addr">0x7a16...f938</div>
        <div className="r-grid">
          <div className="r-stat">
            <div className="l">Portfolio</div>
            <div className="v">$2.41M</div>
          </div>
          <div className="r-stat">
            <div className="l">Risk</div>
            <div className="v green">Low</div>
          </div>
          <div className="r-stat">
            <div className="l">24h Change</div>
            <div className="v up">+2.4%</div>
          </div>
          <div className="r-stat">
            <div className="l">ROI</div>
            <div className="v up">+184%</div>
          </div>
        </div>

        <div className="alloc-bar">
          <div style={{ width: "42%", background: "oklch(50% 0.1 250)" }}>ETH</div>
          <div style={{ width: "28%", background: "oklch(55% 0.1 160)" }}>USDC</div>
          <div style={{ width: "12%", background: "oklch(55% 0.12 310)" }}>AAVE</div>
          <div style={{ width: "18%", background: "oklch(60% 0.06 70)" }}>Other</div>
        </div>
        <div className="alloc-legend">
          <span><span className="dot" style={{ background: "oklch(50% 0.1 250)" }} /> ETH 42%</span>
          <span><span className="dot" style={{ background: "oklch(55% 0.1 160)" }} /> USDC 28%</span>
          <span><span className="dot" style={{ background: "oklch(55% 0.12 310)" }} /> AAVE 12%</span>
          <span><span className="dot" style={{ background: "oklch(60% 0.06 70)" }} /> Other 18%</span>
        </div>

        <div className="defi-mini">
          <div className="l">Active DeFi</div>
          <div className="defi-row">
            <span className="proto">Aave V3</span>
            <span>$820K supplied</span>
          </div>
          <div className="defi-row">
            <span className="proto">Compound</span>
            <span>$340K supplied</span>
          </div>
          <div className="defi-row">
            <span className="proto">Lido</span>
            <span>142 stETH</span>
          </div>
        </div>

        <div className="report-verdict">
          &ldquo;Sophisticated DeFi-native wallet with diversified yield
          strategies and conservative risk management.&rdquo;
        </div>
      </div>
    </div>
  );
}
