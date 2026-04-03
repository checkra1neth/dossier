import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

interface AccessMethod {
  num: string;
  title: string;
  method: string;
  desc: string;
  pipeline: string[];
}

const methods: AccessMethod[] = [
  {
    num: "01",
    title: "REST API",
    method: "POST /research · /quick · /pnl ...",
    desc: "Send a JSON request with any wallet address. Pay with x402 USDC header. Receive structured intelligence in the response body.",
    pipeline: ["x402 pay", "Zerion", "AI", "JSON"],
  },
  {
    num: "02",
    title: "XMTP Direct Message",
    method: "Encrypted P2P",
    desc: "Message the Dossier agent on XMTP. Send a command with a wallet address, receive a full report — end-to-end encrypted, no API key needed.",
    pipeline: ["Receive", "Parse", "Fetch", "Report"],
  },
  {
    num: "03",
    title: "Web Dashboard",
    method: "Launch app →",
    desc: "Paste a wallet address into the web dashboard. View interactive reports with charts, DeFi breakdowns, and real-time data.",
    pipeline: ["Command", "Address", "Report", "Export"],
  },
];

export function HowItWorks(): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.batch(".how-row", {
        onEnter: (elements) => {
          gsap.from(elements, {
            y: 24,
            autoAlpha: 0,
            stagger: 0.12,
            duration: 0.6,
            ease: "power2.out",
          });
        },
        start: "top 85%",
      });

      ScrollTrigger.batch(".pipeline-tag", {
        onEnter: (elements) => {
          gsap.from(elements, {
            scale: 0.9,
            autoAlpha: 0,
            stagger: 0.04,
            duration: 0.35,
            ease: "power2.out",
          });
        },
        start: "top 90%",
      });
    });
  }, { scope: ref });

  return (
    <section className="how-section" id="how" ref={ref}>
      <h2>Three ways to access.</h2>
      {methods.map((row) => (
        <div className="how-row" key={row.num}>
          <div className="row-num">{row.num}</div>
          <div>
            <h3>{row.title}</h3>
            <span className="method">{row.method}</span>
            <div className="pipeline-inline">
              {row.pipeline.map((step, i) => (
                <span key={step}>
                  <span className="pipeline-tag">{step}</span>
                  {i < row.pipeline.length - 1 && <span className="pipeline-arrow">→</span>}
                </span>
              ))}
            </div>
          </div>
          <p>{row.desc}</p>
        </div>
      ))}
    </section>
  );
}
