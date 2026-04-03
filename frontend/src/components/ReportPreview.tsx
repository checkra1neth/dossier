import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

function Sparkline(): ReactNode {
  const pts = [40,38,42,45,43,47,44,48,52,50,55,53,58,56,60,62,59,63,65,68,66,70,72,69,74,76,73,78,80,82];
  const w = 200, h = 36;
  const max = Math.max(...pts), min = Math.min(...pts), r = max - min || 1;
  const s = w / (pts.length - 1);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${i * s},${h - ((p - min) / r) * (h - 4) - 2}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 36, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(45% 0.1 160)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="oklch(45% 0.1 160)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cf)" />
      <path className="chart-line" d={d} fill="none" stroke="oklch(45% 0.1 160)" strokeWidth="1.5" />
    </svg>
  );
}

export function ReportPreview(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ delay: 0.5 });
      tl.from(".rp-row-top", { y: 8, autoAlpha: 0, duration: 0.35, ease: "power3.out" });
      tl.from(".rp-stat", { y: 8, autoAlpha: 0, stagger: 0.05, duration: 0.3, ease: "power2.out" }, "-=0.1");
      tl.from(".rp-spark", { autoAlpha: 0, duration: 0.4, ease: "power2.out" }, "-=0.1");
      tl.from(".chart-line", { strokeDashoffset: 500, duration: 1, ease: "power2.out" }, "-=0.3");
      tl.from(".rp-alloc div", { scaleX: 0, transformOrigin: "left", stagger: 0.06, duration: 0.4, ease: "power2.out" }, "-=0.5");
      tl.from(".rp-defi-row", { x: -6, autoAlpha: 0, stagger: 0.05, duration: 0.25, ease: "power2.out" }, "-=0.1");
      tl.from(".rp-verdict", { autoAlpha: 0, y: 6, duration: 0.3, ease: "power2.out" }, "-=0.05");
      tl.to(ref.current, { y: -5, duration: 2.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
  }, { scope: ref });

  return (
    <div className="rp-card" ref={ref}>
      <div className="rp-header">
        <span>Deep Research Report</span>
        <div className="rp-live" />
      </div>

      <div className="rp-body">
        {/* Row: address + badges */}
        <div className="rp-row-top">
          <span className="rp-addr">0x7a16...f938</span>
          <span className="rp-tag rp-tag-green">Low Risk</span>
          <span className="rp-tag rp-tag-blue">Smart Money</span>
        </div>

        {/* Stats row */}
        <div className="rp-stats">
          <div className="rp-stat">
            <div className="rp-stat-l">Portfolio</div>
            <div className="rp-stat-v">$2.41M</div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-l">24h</div>
            <div className="rp-stat-v rp-up">+2.4%</div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-l">ROI</div>
            <div className="rp-stat-v rp-up">+184%</div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-l">Pos.</div>
            <div className="rp-stat-v">47</div>
          </div>
        </div>

        {/* Sparkline */}
        <div className="rp-spark">
          <Sparkline />
        </div>

        {/* Allocation bar */}
        <div className="rp-alloc">
          <div style={{ width: "42%", background: "oklch(50% 0.1 250)" }}>ETH</div>
          <div style={{ width: "28%", background: "oklch(55% 0.1 160)" }}>USDC</div>
          <div style={{ width: "12%", background: "oklch(55% 0.12 310)" }}>AAVE</div>
          <div style={{ width: "18%", background: "oklch(60% 0.06 70)" }}>Other</div>
        </div>

        {/* DeFi */}
        <div className="rp-defi">
          <div className="rp-defi-row"><span>Aave V3</span><span>$820K</span></div>
          <div className="rp-defi-row"><span>Compound</span><span>$340K</span></div>
          <div className="rp-defi-row"><span>Lido</span><span>142 stETH</span></div>
        </div>

        {/* Verdict */}
        <div className="rp-verdict">
          &ldquo;Sophisticated DeFi-native wallet with diversified yield strategies.&rdquo;
        </div>
      </div>
    </div>
  );
}
