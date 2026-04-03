import { useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ReportPreview } from "./ReportPreview";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }): ReactNode {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.2,
      delay: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(obj.val)}${suffix}`;
      },
    });
  }, [target, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

export function Hero(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Word-by-word title animation
      tl.from(".hero-word", {
        y: 32,
        autoAlpha: 0,
        duration: 0.6,
        stagger: 0.07,
      });

      // Subtitle and actions
      tl.from(".hero-sub", { y: 20, autoAlpha: 0, duration: 0.5 }, "-=0.2");
      tl.from(".hero-actions", { y: 16, autoAlpha: 0, duration: 0.4 }, "-=0.2");
      tl.from(".hero-meta > div", { y: 12, autoAlpha: 0, stagger: 0.08, duration: 0.4 }, "-=0.1");

      // Report card with slight scale
      tl.from(".report-card", {
        y: 40,
        autoAlpha: 0,
        scale: 0.97,
        duration: 0.7,
        ease: "power2.out",
      }, "-=0.4");
    });
  }, { scope: containerRef });

  return (
    <section className="hero" ref={containerRef}>
      <div className="hero-text">
        <h1>
          <span className="hero-word">On-chain</span>{" "}
          <span className="hero-word">intelligence,</span>{" "}
          <em><span className="hero-word">wired</span>{" "}
          <span className="hero-word">to</span>{" "}
          <span className="hero-word">you.</span></em>
        </h1>
        <p className="hero-sub">
          Fourteen commands. Any wallet. Portfolio analysis, DeFi positions, PnL
          tracking, swaps, bridges, and deep AI research — delivered in seconds
          via REST, XMTP, or web dashboard.
        </p>
        <div className="hero-actions">
          <Link to="/app" className="pill">Launch app</Link>
          <a href="#commands" className="text-link">View commands &rarr;</a>
        </div>
        <div className="hero-meta">
          <div>
            <strong><AnimatedCounter target={14} /></strong>commands
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
