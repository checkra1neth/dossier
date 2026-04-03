# Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build landing page + interactive dashboard for OWS Intelligence Wire v2, serving all 7 analytics commands.

**Architecture:** Vite + React + TypeScript frontend in `frontend/` directory. React Router for landing (`/`) and dashboard (`/app`). GSAP + ScrollTrigger for all animations (scroll reveals, staggered entrances, section transitions). Express serves the built static files. Design system: warm sand/cream palette (OWS Hackathon style), Newsreader + Instrument Sans typography.

**Tech Stack:** Vite 6, React 19, TypeScript, React Router, GSAP + @gsap/react + ScrollTrigger, Google Fonts (Newsreader + Instrument Sans)

**Animation guidelines (GSAP skills):**
- Use `useGSAP()` hook from `@gsap/react` with `scope` ref — never raw `useEffect` for GSAP
- Register plugins once: `gsap.registerPlugin(useGSAP, ScrollTrigger)`
- Use `ScrollTrigger.batch()` for staggered scroll reveals
- Use transform aliases (`x`, `y`, `scale`, `rotation`) — never animate layout properties
- Use `autoAlpha` instead of `opacity` for fade in/out
- Use `gsap.matchMedia()` for `prefers-reduced-motion` — set `duration: 0` when reduced motion preferred
- Cleanup is automatic with `useGSAP()` — no manual `ctx.revert()` needed

---

### Task 1: Scaffold React + Vite project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "ows-intelligence-wire-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "gsap": "^3.12.0",
    "@gsap/react": "^2.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/research": "http://localhost:4000",
      "/quick": "http://localhost:4000",
      "/pnl": "http://localhost:4000",
      "/defi": "http://localhost:4000",
      "/history": "http://localhost:4000",
      "/nft": "http://localhost:4000",
      "/compare": "http://localhost:4000",
      "/health": "http://localhost:4000",
    },
  },
});
```

- [ ] **Step 3: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OWS Intelligence Wire</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;0,6..72,800;1,6..72,400&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: Create `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./styles/base.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 7: Create `frontend/src/App.tsx`**

```tsx
import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard />} />
    </Routes>
  );
}
```

- [ ] **Step 8: Install dependencies**

Run: `cd frontend && npm install`

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold React + Vite + GSAP frontend"
```

---

### Task 2: Base CSS tokens

**Files:**
- Create: `frontend/src/styles/base.css`

- [ ] **Step 1: Create `frontend/src/styles/base.css`**

```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { font-size: 16px; -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }

:root {
  --sand-0: oklch(96.5% 0.012 75);
  --sand-1: oklch(94% 0.015 72);
  --sand-2: oklch(90% 0.02 70);
  --sand-3: oklch(85% 0.02 68);
  --ink: oklch(15% 0.01 65);
  --ink-2: oklch(38% 0.012 65);
  --ink-3: oklch(55% 0.01 68);
  --ink-muted: oklch(68% 0.008 70);
  --accent: oklch(45% 0.1 160);
  --accent-light: oklch(92% 0.03 160);
  --danger: oklch(55% 0.15 25);
  --warning: oklch(60% 0.14 75);
  --font-display: 'Newsreader', Georgia, serif;
  --font-body: 'Instrument Sans', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

body {
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--sand-0);
  line-height: 1.6;
}

a { color: inherit; }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/base.css
git commit -m "feat(frontend): add base CSS tokens"
```

---

### Task 3: Landing page — components + GSAP animations

**Files:**
- Create: `frontend/src/pages/Landing.tsx`
- Create: `frontend/src/styles/landing.css`
- Create: `frontend/src/components/Nav.tsx`
- Create: `frontend/src/components/Hero.tsx`
- Create: `frontend/src/components/ReportPreview.tsx`
- Create: `frontend/src/components/CommandsGrid.tsx`
- Create: `frontend/src/components/Pipeline.tsx`
- Create: `frontend/src/components/HowItWorks.tsx`
- Create: `frontend/src/components/PricingTable.tsx`
- Create: `frontend/src/components/Footer.tsx`

- [ ] **Step 1: Create `frontend/src/components/Nav.tsx`**

Shared nav component. Takes `cta` prop ("Launch app" for landing, hidden on dashboard since dashboard has its own topbar).

```tsx
import { Link } from "react-router-dom";

interface NavProps {
  cta?: { label: string; to: string };
}

export function Nav({ cta }: NavProps): JSX.Element {
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">Intelligence Wire</Link>
      <div className="nav-r">
        <a href="#commands">Commands</a>
        <a href="#pipeline">Pipeline</a>
        <a href="#pricing">Pricing</a>
        {cta && <Link to={cta.to} className="pill">{cta.label}</Link>}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/Hero.tsx`**

Asymmetric 2-column hero with GSAP staggered entrance using `useGSAP()`:

```tsx
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ReportPreview } from "./ReportPreview";

export function Hero(): JSX.Element {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".hero-text > *", {
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power3.out",
      });
      gsap.from(".report-card", {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        delay: 0.3,
        ease: "power3.out",
      });
    });
  }, { scope: containerRef });

  return (
    <section className="hero" ref={containerRef}>
      <div className="hero-text">
        <h1>On-chain intelligence, <em>wired to you.</em></h1>
        <p className="hero-sub">
          Seven analytics commands. Portfolio, PnL, DeFi positions, NFTs,
          transaction history, wallet comparison. Pay per query — no accounts, no subscriptions.
        </p>
        <div className="hero-actions">
          <Link to="/app" className="pill" style={{ padding: "12px 28px", fontSize: "0.9rem" }}>
            Launch dashboard
          </Link>
          <a href="#commands" className="text-link">View commands →</a>
        </div>
        <div className="hero-meta">
          <div><strong>7 commands</strong>from $0.01/query</div>
          <div><strong>&lt;10s</strong>full pipeline</div>
          <div><strong>x402</strong>USDC on Base</div>
        </div>
      </div>
      <ReportPreview />
    </section>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ReportPreview.tsx`**

The hero's report card preview (static mock data):

```tsx
export function ReportPreview(): JSX.Element {
  return (
    <div className="report-card">
      <div className="report-header">
        <span>Deep Research Report</span>
        <div className="report-live" />
      </div>
      <div className="report-body">
        <div className="report-addr">0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</div>
        <div className="r-grid">
          <div className="r-stat"><div className="l">Portfolio</div><div className="v">$2.41M</div></div>
          <div className="r-stat"><div className="l">Risk</div><div className="v green">Low</div></div>
          <div className="r-stat"><div className="l">24h change</div><div className="v up">+2.4%</div></div>
          <div className="r-stat"><div className="l">ROI</div><div className="v up">+184%</div></div>
        </div>
        <div className="alloc-bar">
          <div style={{ flex: 42, background: "oklch(35% 0.08 250)" }}>ETH</div>
          <div style={{ flex: 28, background: "oklch(50% 0.1 160)" }}>USDC</div>
          <div style={{ flex: 12, background: "oklch(55% 0.12 310)" }}>AAVE</div>
          <div style={{ flex: 18, background: "oklch(65% 0.06 70)" }} />
        </div>
        <div className="defi-mini">
          <div className="l">DeFi positions</div>
          <div className="defi-row"><span><span className="proto">Aave V3</span> · deposited</span><span>$289K</span></div>
          <div className="defi-row"><span><span className="proto">Compound</span> · staked</span><span>$192K</span></div>
          <div className="defi-row"><span><span className="proto">Lido</span> · staked</span><span>$84K</span></div>
        </div>
        <div className="report-verdict">
          "Sophisticated DeFi native. +184% ROI, diversified blue-chip strategy. Worth tracking."
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/CommandsGrid.tsx`**

7-command grid with `ScrollTrigger.batch()` stagger:

```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const COMMANDS = [
  { name: "/quick", desc: "Portfolio snapshot — total value, 24h change, top 3 holdings, active chains.", price: "$0.01" },
  { name: "/research", desc: "Full deep research — LLM analysis, risk scoring, wallet profiling, DeFi + PnL data.", price: "$0.05" },
  { name: "/pnl", desc: "Profit & loss — realized gains, unrealized gains, fees paid, net ROI.", price: "$0.02" },
  { name: "/defi", desc: "DeFi positions — deposits, stakes, locked tokens, rewards. Grouped by protocol.", price: "$0.02" },
  { name: "/history", desc: "Transaction history — last 20 txns, activity pattern, frequency analysis.", price: "$0.02" },
  { name: "/nft", desc: "NFT portfolio — top collections by floor price, counts, estimated total value.", price: "$0.02" },
  { name: "/compare", desc: "Head-to-head comparison of two wallets — value, ROI, chains, LLM verdict.", price: "$0.05" },
];

export function CommandsGrid(): JSX.Element {
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
        <h2>Seven ways to read any wallet.</h2>
        <p>Each command hits the Zerion API, runs analysis, and returns structured data. Pick what you need — from a $0.01 snapshot to a $0.05 deep research report.</p>
      </div>
      <div className="cmd-grid">
        {COMMANDS.map((cmd) => (
          <div key={cmd.name} className="cmd-cell">
            <div className="cmd-name">{cmd.name}</div>
            <div className="cmd-desc">{cmd.desc}</div>
            <div className="cmd-price">{cmd.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/Pipeline.tsx`**

5-step flow with staggered reveal:

```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const STEPS = [
  { num: "I", title: "Payment", desc: "x402 verifies USDC on Base. No API keys needed.", tag: "x402" },
  { num: "II", title: "Portfolio", desc: "Value, chains, 24h changes. Dust filtered.", tag: "zerion/portfolio" },
  { num: "III", title: "Positions", desc: "Spot + DeFi + NFTs. PnL and transactions.", tag: "zerion/positions" },
  { num: "IV", title: "Analysis", desc: "LLM builds wallet profile, risk score, patterns.", tag: "openrouter" },
  { num: "V", title: "Report", desc: "Structured JSON + markdown. Ready to render.", tag: "json · md" },
];

export function Pipeline(): JSX.Element {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.batch(".flow-step", {
        onEnter: (elements) => {
          gsap.from(elements, { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.45, ease: "power3.out" });
        },
        start: "top 85%",
      });
    });
  }, { scope: ref });

  return (
    <section className="pipeline-section" id="pipeline" ref={ref}>
      <div className="pipeline-header">
        <h2>Five data sources, one pipeline.</h2>
        <p>Portfolio, positions, DeFi, PnL, and transactions fetched in parallel. LLM synthesizes everything into a verdict.</p>
      </div>
      <div className="pipeline-flow">
        {STEPS.map((s) => (
          <div key={s.num} className="flow-step">
            <div className="num">{s.num}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
            <div className="tag">{s.tag}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `HowItWorks.tsx`, `PricingTable.tsx`, `Footer.tsx`**

Same pattern — data-driven components with `ScrollTrigger.batch()` reveals. HowItWorks: 3 editorial rows. PricingTable: 7-row table. Footer: logo + links. Use the exact HTML structure and content from the approved landing-v3 mockup.

- [ ] **Step 7: Create `frontend/src/pages/Landing.tsx`**

Compose all sections:

```tsx
import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { CommandsGrid } from "../components/CommandsGrid";
import { Pipeline } from "../components/Pipeline";
import { HowItWorks } from "../components/HowItWorks";
import { PricingTable } from "../components/PricingTable";
import { Footer } from "../components/Footer";
import "../styles/landing.css";

const PARTNERS = ["OWS", "x402", "XMTP", "Zerion", "OpenRouter", "Base"];

export function Landing(): JSX.Element {
  return (
    <>
      <Nav cta={{ label: "Launch app", to: "/app" }} />
      <div className="wrap">
        <Hero />
        <div className="partners">
          <span className="partners-label">Built with</span>
          <div className="partners-logos">
            {PARTNERS.map((p) => <span key={p}>{p}</span>)}
          </div>
        </div>
        <CommandsGrid />
        <Pipeline />
        <HowItWorks />
        <PricingTable />
        <Footer />
      </div>
    </>
  );
}
```

- [ ] **Step 8: Create `frontend/src/styles/landing.css`**

Extract all landing-specific CSS from the approved landing-v3 mockup (nav, hero, report-card, partners, commands-grid, pipeline-flow, how-section, pricing-table, footer, responsive breakpoints). Remove animation CSS — all animation is handled by GSAP now.

- [ ] **Step 9: Verify dev server**

Run: `cd frontend && npm run dev`
Open: `http://localhost:3000`
Expected: Landing page renders with all sections. GSAP scroll-triggered stagger animations work. `prefers-reduced-motion` respected.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add landing page with GSAP scroll animations"
```

---

### Task 4: API client

**Files:**
- Create: `frontend/src/api.ts`

- [ ] **Step 1: Create `frontend/src/api.ts`**

```typescript
export type Command = "quick" | "research" | "pnl" | "defi" | "history" | "nft" | "compare";

export const COMMANDS: { cmd: Command; label: string; price: string }[] = [
  { cmd: "quick", label: "/quick", price: "$0.01" },
  { cmd: "research", label: "/research", price: "$0.05" },
  { cmd: "pnl", label: "/pnl", price: "$0.02" },
  { cmd: "defi", label: "/defi", price: "$0.02" },
  { cmd: "history", label: "/history", price: "$0.02" },
  { cmd: "nft", label: "/nft", price: "$0.02" },
  { cmd: "compare", label: "/compare", price: "$0.05" },
];

export function getPrice(cmd: Command): string {
  return COMMANDS.find((c) => c.cmd === cmd)?.price ?? "$0.05";
}

export async function query<T>(command: Command, body: Record<string, string>): Promise<T> {
  const res = await fetch(`/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 402) {
    throw new Error(`Payment required: ${getPrice(command)} USDC on Base`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(frontend): add API client"
```

---

### Task 5: Report rendering components

**Files:**
- Create: `frontend/src/components/reports/ResearchReport.tsx`
- Create: `frontend/src/components/reports/QuickReport.tsx`
- Create: `frontend/src/components/reports/PnlReport.tsx`
- Create: `frontend/src/components/reports/DefiReport.tsx`
- Create: `frontend/src/components/reports/HistoryReport.tsx`
- Create: `frontend/src/components/reports/NftReport.tsx`
- Create: `frontend/src/components/reports/CompareReport.tsx`
- Create: `frontend/src/components/reports/index.tsx`

- [ ] **Step 1: Create report components**

Each report component takes the API response as props and renders the report view. Follow the exact layout from the approved dashboard-v2 mockup. Each component uses `useGSAP()` for entrance animation (stats fade in, sections stagger).

Example — `ResearchReport.tsx`:

```tsx
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface Props {
  data: {
    address: string;
    timestamp: number;
    data: {
      totalValueUsd: number;
      chains: string[];
      topPositions: { asset: string; valueUsd: number; percentage: number }[];
      isSmartMoney: boolean;
      positionCount: number;
    };
    analysis: {
      summary: string;
      riskLevel: "low" | "medium" | "high";
      patterns: string[];
      verdict: string;
    };
  };
}

export function ResearchReport({ data: report }: Props): JSX.Element {
  const ref = useRef<div>(null);

  useGSAP(() => {
    gsap.from(".stat", { y: 12, autoAlpha: 0, stagger: 0.05, duration: 0.4, ease: "power3.out" });
    gsap.from(".report-body > *", { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.5, delay: 0.2, ease: "power3.out" });
  }, { scope: ref });

  const { address, data, analysis } = report;
  const risk = analysis.riskLevel;
  // ... render stats, analysis, allocation, patterns, chains
  // Use exact HTML structure from dashboard-v2 mockup
}
```

Same pattern for QuickReport, PnlReport, DefiReport, HistoryReport, NftReport, CompareReport — each renders its specific data shape with GSAP entrance animations.

- [ ] **Step 2: Create `frontend/src/components/reports/index.tsx`**

Router that picks the right component based on command:

```tsx
import type { Command } from "../../api";
import { ResearchReport } from "./ResearchReport";
import { QuickReport } from "./QuickReport";
import { PnlReport } from "./PnlReport";
import { DefiReport } from "./DefiReport";
import { HistoryReport } from "./HistoryReport";
import { NftReport } from "./NftReport";
import { CompareReport } from "./CompareReport";

interface Props {
  command: Command;
  data: unknown;
}

export function ReportView({ command, data }: Props): JSX.Element {
  switch (command) {
    case "research": return <ResearchReport data={data as any} />;
    case "quick": return <QuickReport data={data as any} />;
    case "pnl": return <PnlReport data={data as any} />;
    case "defi": return <DefiReport data={data as any} />;
    case "history": return <HistoryReport data={data as any} />;
    case "nft": return <NftReport data={data as any} />;
    case "compare": return <CompareReport data={data as any} />;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/reports/
git commit -m "feat(frontend): add report rendering components for all 7 commands"
```

---

### Task 6: Dashboard page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/styles/dashboard.css`

- [ ] **Step 1: Create `frontend/src/pages/Dashboard.tsx`**

```tsx
import { useState, useCallback } from "react";
import { query, COMMANDS, getPrice, type Command } from "../api";
import { ReportView } from "../components/reports";
import "../styles/dashboard.css";

interface HistoryEntry {
  command: Command;
  address: string;
  summary: string;
  cost: string;
  time: Date;
}

export function Dashboard(): JSX.Element {
  const [activeCmd, setActiveCmd] = useState<Command>("research");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ command: Command; data: unknown } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleSearch = useCallback(async () => {
    const addresses = input.match(/0x[a-fA-F0-9]{40}/g);
    if (activeCmd === "compare") {
      if (!addresses || addresses.length < 2) { setError("Enter two valid addresses."); return; }
    } else {
      if (!addresses || addresses.length === 0) { setError("Enter a valid wallet address (0x...)."); return; }
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const body = activeCmd === "compare"
        ? { addressA: addresses![0], addressB: addresses![1] }
        : { address: addresses![0] };

      const data = await query(activeCmd, body);
      setReport({ command: activeCmd, data });
      setHistory((prev) => [
        { command: activeCmd, address: addresses![0], summary: "Done", cost: getPrice(activeCmd), time: new Date() },
        ...prev,
      ].slice(0, 20));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [activeCmd, input]);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <a href="/" className="topbar-logo">Intelligence Wire</a>
          <nav className="topbar-nav">
            <span className="active">Research</span>
          </nav>
        </div>
      </div>

      <div className="main">
        <div className="search-area">
          <div className="search-top">
            <h1>Research</h1>
            <div className="cmd-tabs">
              {COMMANDS.map((c) => (
                <button
                  key={c.cmd}
                  className={`cmd-tab ${activeCmd === c.cmd ? "active" : ""}`}
                  onClick={() => setActiveCmd(c.cmd)}
                >
                  {c.label} <span className="price">{c.price}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="search-row">
            <input
              className="search-input"
              placeholder={activeCmd === "compare" ? "0xaddr1 0xaddr2" : "0x..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="search-btn" onClick={handleSearch} disabled={loading}>
              {loading ? "Loading..." : `${activeCmd.charAt(0).toUpperCase() + activeCmd.slice(1)} · ${getPrice(activeCmd)}`}
            </button>
          </div>
          <div className="search-hint">Paid via x402 · USDC on Base · settles instantly</div>
        </div>

        {error && (
          <div className="empty-state"><p style={{ color: "var(--danger)" }}>Error: {error}</p></div>
        )}

        {report && <ReportView command={report.command} data={report.data} />}

        {!report && !error && !loading && (
          <div className="empty-state"><p>Enter a wallet address and pick a command to start.</p></div>
        )}

        {history.length > 0 && (
          <div className="history-section">
            <div className="txn-header">
              <h3>Query history</h3>
              <span>{history.length} queries</span>
            </div>
            <table>
              <thead><tr><th>Command</th><th>Address</th><th>Cost</th><th>Time</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td><span className="mono">/{h.command}</span></td>
                    <td><span className="mono">{h.address.slice(0, 6)}...{h.address.slice(-4)}</span></td>
                    <td>{h.cost}</td>
                    <td style={{ color: "var(--ink-3)" }}>{h.time.toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `frontend/src/styles/dashboard.css`**

Extract all dashboard CSS from the approved dashboard-v2 mockup: topbar, search area, cmd-tabs, stats-row, report-body, analysis, sidebar, allocation list, defi list, pnl grid, transaction table, badges, history, responsive breakpoints.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run dev` (with backend on :4000)
Open: `http://localhost:3000/app`
Test: Tab switching works, search submits, reports render (or 402 if payment middleware active).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/styles/dashboard.css
git commit -m "feat(frontend): add dashboard page with search and report rendering"
```

---

### Task 7: Express static file serving

**Files:**
- Modify: `src/index.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add static file serving to Express**

Add imports at top of `src/index.ts`:
```typescript
import { fileURLToPath } from "url";
import { dirname, join } from "path";
```

Add after all API routes:
```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, "..", "frontend", "dist");

app.use(express.static(frontendDist));

// SPA fallback — React Router handles client-side routing
app.get("*", (_req, res) => {
  res.sendFile(join(frontendDist, "index.html"));
});
```

- [ ] **Step 2: Add build scripts to root `package.json`**

```json
"build:frontend": "cd frontend && npm run build"
```

- [ ] **Step 3: Add to `.gitignore`**

```
frontend/dist/
frontend/node_modules/
```

- [ ] **Step 4: Build and verify**

Run: `cd frontend && npm run build && cd .. && npm run dev`
Open: `http://localhost:4000` → landing
Open: `http://localhost:4000/app` → dashboard

- [ ] **Step 5: Commit**

```bash
git add src/index.ts package.json .gitignore
git commit -m "feat: serve React frontend from Express"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Build and start**

```bash
cd frontend && npm run build && cd .. && npm run dev
```

- [ ] **Step 2: Verify landing page**

Open: `http://localhost:4000`
- All sections render
- GSAP scroll animations trigger (staggered reveals on commands, pipeline, sections)
- `prefers-reduced-motion` is respected (no motion when enabled)
- "Launch dashboard" navigates to `/app`
- Responsive at mobile widths

- [ ] **Step 3: Verify dashboard**

Open: `http://localhost:4000/app`
- Command tabs switch, button label updates
- Search calls API
- Reports render with GSAP entrance animations
- History table populates
- Compare mode asks for two addresses

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(frontend): complete React + GSAP landing + dashboard"
```
