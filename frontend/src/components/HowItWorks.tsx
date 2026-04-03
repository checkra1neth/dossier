import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

const rows = [
  {
    num: "01",
    title: "REST API",
    method: "POST /research \u00B7 /quick \u00B7 /pnl ...",
    desc: "Send a JSON request with any wallet address. Pay with x402 USDC header. Receive structured intelligence in the response body.",
  },
  {
    num: "02",
    title: "XMTP Direct Message",
    method: "Encrypted P2P",
    desc: "Message the Intelligence Wire agent on XMTP. Send a wallet address, receive a full report — end-to-end encrypted, no API key needed.",
  },
  {
    num: "03",
    title: "Web Dashboard",
    method: "Launch app",
    desc: "Paste a wallet address into the web dashboard. View interactive reports with charts, DeFi breakdowns, and exportable data.",
  },
];

export function HowItWorks(): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.batch(".how-row", {
        onEnter: (elements) => {
          gsap.from(elements, { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.5, ease: "power3.out" });
        },
        start: "top 85%",
      });
    });
  }, { scope: ref });

  return (
    <section className="how-section" ref={ref}>
      <h2>Three ways to access.</h2>
      {rows.map((row) => (
        <div className="how-row" key={row.num}>
          <div className="row-num">{row.num}</div>
          <div>
            <h3>{row.title}</h3>
            <span className="method">{row.method}</span>
          </div>
          <p>{row.desc}</p>
        </div>
      ))}
    </section>
  );
}
