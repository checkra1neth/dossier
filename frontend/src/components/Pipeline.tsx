import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

const steps = [
  { num: "I", title: "Payment", desc: "x402 USDC micro-payment verified on Base before execution.", tag: "x402" },
  { num: "II", title: "Portfolio", desc: "Fetch full token balances, prices, and portfolio value.", tag: "zerion/portfolio" },
  { num: "III", title: "Positions", desc: "Resolve active DeFi positions, staking, and LP allocations.", tag: "zerion/positions" },
  { num: "IV", title: "Analysis", desc: "AI-powered synthesis of on-chain data into structured insights.", tag: "openrouter" },
  { num: "V", title: "Report", desc: "Formatted output delivered as JSON or Markdown.", tag: "json \u00B7 md" },
];

export function Pipeline(): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.batch(".flow-step", {
        onEnter: (elements) => {
          gsap.from(elements, { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.5, ease: "power3.out" });
        },
        start: "top 85%",
      });
    });
  }, { scope: ref });

  return (
    <section className="pipeline-section" id="pipeline" ref={ref}>
      <div className="pipeline-header">
        <h2>Five-stage pipeline, under ten seconds.</h2>
        <p>
          Every request flows through the same deterministic pipeline. Payment
          first, data aggregation second, AI analysis third.
        </p>
      </div>
      <div className="pipeline-flow">
        {steps.map((step) => (
          <div className="flow-step" key={step.num}>
            <div className="num">{step.num}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
            <span className="tag">{step.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
