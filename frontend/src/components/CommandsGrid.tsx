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
  { name: "/quick", desc: "Fast portfolio snapshot with token balances and total value.", price: "$0.01" },
  { name: "/pnl", desc: "Realized and unrealized PnL breakdown by token with cost basis.", price: "$0.02" },
  { name: "/defi", desc: "Active DeFi positions across lending, staking, and LP protocols.", price: "$0.02" },
  { name: "/history", desc: "Recent transaction history with decoded contract interactions.", price: "$0.02" },
  { name: "/nft", desc: "NFT holdings with floor prices, rarity, and collection stats.", price: "$0.02" },
  { name: "/research", desc: "Deep AI-powered research report with risk analysis and insights.", price: "$0.05" },
  { name: "/compare", desc: "Side-by-side comparison of two wallets across all metrics.", price: "$0.05" },
];

const wallet: CmdEntry[] = [
  { name: "/balance", desc: "Current token balances with USD values and allocation breakdown.", price: "FREE" },
  { name: "/swap", desc: "Token swap with best route aggregation across DEX protocols.", price: "$0.01" },
  { name: "/bridge", desc: "Cross-chain bridge with optimized routing and gas estimation.", price: "$0.01" },
  { name: "/send", desc: "Send tokens to any address with transaction confirmation.", price: "$0.01" },
];

const monitoring: CmdEntry[] = [
  { name: "/watch", desc: "Set up real-time monitoring alerts for a wallet address.", price: "$0.10" },
  { name: "/unwatch", desc: "Remove monitoring alerts for a previously watched wallet.", price: "FREE" },
];

function CmdSection({ label, commands }: { label: string; commands: CmdEntry[] }): ReactNode {
  return (
    <>
      <h3 className="cmd-section-label">{label}</h3>
      <div className="cmd-grid">
        {commands.map((cmd) => (
          <div className="cmd-cell" key={cmd.name}>
            <div className="cmd-name">{cmd.name}</div>
            <div className="cmd-desc">{cmd.desc}</div>
            <div className="cmd-price">{cmd.price === "FREE" ? "FREE" : `${cmd.price} USDC`}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function CommandsGrid(): ReactNode {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.batch(".cmd-cell", {
        onEnter: (elements) => {
          gsap.from(elements, { y: 20, autoAlpha: 0, stagger: 0.06, duration: 0.5, ease: "power3.out" });
        },
        start: "top 85%",
      });
    });
  }, { scope: ref });

  return (
    <section className="commands-section" id="commands" ref={ref}>
      <div className="commands-header">
        <h2>Thirteen commands, one protocol.</h2>
        <p>
          Each command is a single API call. Pay per request with x402 USDC on
          Base — no API keys, no subscriptions, no rate limits.
        </p>
      </div>
      <CmdSection label="Analytics" commands={analytics} />
      <CmdSection label="Wallet Actions" commands={wallet} />
      <CmdSection label="Monitoring" commands={monitoring} />
    </section>
  );
}
