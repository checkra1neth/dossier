import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

const pricing = [
  { cmd: "/quick", desc: "Fast portfolio snapshot", price: "$0.01" },
  { cmd: "/pnl", desc: "Realized & unrealized PnL breakdown", price: "$0.02" },
  { cmd: "/defi", desc: "Active DeFi positions", price: "$0.02" },
  { cmd: "/history", desc: "Recent transaction history", price: "$0.02" },
  { cmd: "/nft", desc: "NFT holdings & floor prices", price: "$0.02" },
  { cmd: "/research", desc: "Deep AI-powered research report", price: "$0.05" },
  { cmd: "/compare", desc: "Side-by-side wallet comparison", price: "$0.05" },
];

export function PricingTable(): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.create({
        trigger: ".pricing-table",
        start: "top 85%",
        onEnter: () => {
          gsap.from(".pricing-table", { y: 20, autoAlpha: 0, duration: 0.6, ease: "power3.out" });
        },
      });
    });
  }, { scope: ref });

  return (
    <section className="pricing-section" id="pricing" ref={ref}>
      <div className="pricing-header">
        <h2>Simple, per-call pricing.</h2>
        <p>
          No subscriptions. No rate limits. Pay exactly for what you use with
          x402 USDC on Base.
        </p>
      </div>
      <table className="pricing-table">
        <thead>
          <tr>
            <th>Command</th>
            <th>Description</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {pricing.map((row) => (
            <tr key={row.cmd}>
              <td className="mono">{row.cmd}</td>
              <td>{row.desc}</td>
              <td className="price-val">{row.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
