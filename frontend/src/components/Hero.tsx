import { useRef } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ReportPreview } from "./ReportPreview";

export function Hero(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".hero-text > *", { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".report-card", { y: 30, autoAlpha: 0, duration: 0.8, delay: 0.3, ease: "power3.out" });
    });
  }, { scope: containerRef });

  return (
    <section className="hero" ref={containerRef}>
      <div className="hero-text">
        <h1>On-chain intelligence, <em>wired to you.</em></h1>
        <p className="hero-sub">
          Seven commands. Any wallet. Portfolio analysis, DeFi positions, PnL
          tracking, and deep research — delivered in seconds via REST, XMTP, or
          web dashboard.
        </p>
        <div className="hero-actions">
          <Link to="/app" className="pill">Launch dashboard</Link>
          <a href="#commands" className="text-link">View commands &rarr;</a>
        </div>
        <div className="hero-meta">
          <div>
            <strong>7</strong>commands
          </div>
          <div>
            <strong>&lt;10s</strong>response time
          </div>
          <div>
            <strong>x402</strong>pay-per-call
          </div>
        </div>
      </div>
      <ReportPreview />
    </section>
  );
}
