import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

interface CmdEntry {
  name: string;
  desc: string;
  price: string;
}

const analytics: CmdEntry[] = [
  { name: "/quick", desc: "Portfolio snapshot", price: "$0.01" },
  { name: "/pnl", desc: "Profit & loss breakdown", price: "$0.02" },
  { name: "/defi", desc: "DeFi positions", price: "$0.02" },
  { name: "/history", desc: "Transaction history", price: "$0.02" },
  { name: "/nft", desc: "NFT holdings", price: "$0.02" },
  { name: "/research", desc: "Deep AI research report", price: "$0.05" },
  { name: "/compare", desc: "Side-by-side wallet comparison", price: "$0.05" },
];

const wallet: CmdEntry[] = [
  { name: "/balance", desc: "Token balances & allocation", price: "FREE" },
  { name: "/swap", desc: "DEX aggregated swap", price: "$0.01" },
  { name: "/bridge", desc: "Cross-chain bridge", price: "$0.01" },
  { name: "/send", desc: "Send tokens", price: "$0.01" },
];

const monitoring: CmdEntry[] = [
  { name: "/watch", desc: "Real-time wallet alerts", price: "$0.10" },
  { name: "/unwatch", desc: "Remove alerts", price: "FREE" },
];

function CmdGroup({ label, commands }: { label: string; commands: CmdEntry[] }): ReactNode {
  return (
    <div className="cmd-group-section">
      <div className="cmd-group-header">{label}</div>
      <div className="cmd-rows">
        {commands.map((cmd) => (
          <div className="cmd-row" key={cmd.name}>
            <span className="cmd-name">{cmd.name}</span>
            <span className="cmd-desc">{cmd.desc}</span>
            <span className="cmd-price">{cmd.price === "FREE" ? "FREE" : `${cmd.price}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommandsGrid(): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".commands-header > *", {
        y: 20,
        autoAlpha: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: ".commands-header", start: "top 85%" },
      });

      ScrollTrigger.batch(".cmd-row", {
        onEnter: (elements) => {
          gsap.from(elements, {
            x: -12,
            autoAlpha: 0,
            stagger: 0.03,
            duration: 0.35,
            ease: "power2.out",
          });
        },
        start: "top 90%",
      });
    });
  }, { scope: ref });

  return (
    <section className="commands-section" id="commands" ref={ref}>
      <div className="commands-header">
        <h2>Fourteen commands, one protocol.</h2>
        <p>
          Each command is a single API call. Pay per request with x402 USDC on
          Base — no API keys, no subscriptions, no rate limits.
        </p>
      </div>
      <div className="cmd-groups-wrap">
        <CmdGroup label="Analytics" commands={analytics} />
        <CmdGroup label="Wallet" commands={wallet} />
        <CmdGroup label="Monitor" commands={monitoring} />
      </div>
    </section>
  );
}
