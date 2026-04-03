import type { ReactNode } from "react";
import "../styles/landing.css";
import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { CommandsGrid } from "../components/CommandsGrid";
import { HowItWorks } from "../components/HowItWorks";
import { Footer } from "../components/Footer";

function Partners(): ReactNode {
  return (
    <div className="partners">
      <span className="partners-label">Powered by</span>
      <div className="partners-logos">
        <span>OWS</span>
        <span>Zerion</span>
        <span>OpenRouter</span>
        <span>XMTP</span>
        <span>Coinbase x402</span>
        <span>Base</span>
      </div>
    </div>
  );
}

export function Landing(): ReactNode {
  return (
    <>
      <Nav />
      <div className="wrap">
        <Hero />
        <Partners />
        <CommandsGrid />
        <HowItWorks />
        <Footer />
      </div>
    </>
  );
}
