# Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build landing page + interactive dashboard for OWS Intelligence Wire v2, serving all 7 analytics commands.

**Architecture:** Vite + vanilla TypeScript frontend in `frontend/` directory. Two HTML entry points (landing + dashboard). Express serves the built static files. Wallet connection via viem, x402 payments via `@x402/fetch`.

**Tech Stack:** Vite 6, TypeScript, viem, @x402/fetch, Google Fonts (Newsreader + Instrument Sans)

---

### Task 1: Scaffold Vite project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "ows-intelligence-wire-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "viem": "^2.47.6"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app.html"),
      },
    },
  },
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
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Install dependencies**

Run: `cd frontend && npm install`

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/package-lock.json
git commit -m "chore: scaffold Vite frontend project"
```

---

### Task 2: Base CSS — variables, reset, typography

**Files:**
- Create: `frontend/styles/base.css`

- [ ] **Step 1: Create `frontend/styles/base.css`**

```css
/* ── Reset ── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { font-size: 16px; -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }

/* ── Tokens ── */
:root {
  /* Palette — warm sand/cream (OWS Hackathon) */
  --sand-0: oklch(96.5% 0.012 75);
  --sand-1: oklch(94% 0.015 72);
  --sand-2: oklch(90% 0.02 70);
  --sand-3: oklch(85% 0.02 68);

  --ink: oklch(15% 0.01 65);
  --ink-2: oklch(38% 0.012 65);
  --ink-3: oklch(55% 0.01 68);
  --ink-muted: oklch(68% 0.008 70);

  /* Accent — earthy green */
  --accent: oklch(45% 0.1 160);
  --accent-light: oklch(92% 0.03 160);

  /* Semantic */
  --danger: oklch(55% 0.15 25);
  --warning: oklch(60% 0.14 75);

  /* Spacing — 4pt base */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;
  --space-5xl: 128px;

  /* Typography */
  --font-display: 'Newsreader', Georgia, serif;
  --font-body: 'Instrument Sans', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

  /* Motion */
  --ease: cubic-bezier(0.25, 1, 0.5, 1);
}

body {
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--sand-0);
  line-height: 1.6;
}

/* ── Shared components ── */
.pill {
  background: var(--ink);
  color: var(--sand-0);
  padding: 8px 20px;
  border-radius: 100px;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 200ms;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
}
.pill:hover { opacity: 0.85; }

.section-title {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-muted);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--sand-2);
}

.mono { font-family: var(--font-mono); font-size: 0.76rem; color: var(--ink-2); }

/* ── Scroll reveal ── */
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 500ms var(--ease), transform 500ms var(--ease);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/styles/base.css
git commit -m "feat(frontend): add base CSS tokens and reset"
```

---

### Task 3: Landing page — HTML + CSS

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/styles/landing.css`
- Create: `frontend/src/main.ts`

- [ ] **Step 1: Create `frontend/index.html`**

Full landing page HTML from the approved v3 mockup. Structure:
- `<nav>` — logo, links, pill CTA
- `<section class="hero">` — asymmetric 2-col (text + report card)
- `<div class="partners">` — partner logos strip
- `<section class="commands-section">` — 7-command grid
- `<section class="pipeline-section">` — 5-step flow
- `<section class="how-section">` — 3 editorial rows
- `<section class="pricing-section">` — pricing table
- `<footer>`

Copy the exact HTML from `.superpowers/brainstorm/47359-1775242821/content/landing-v3.html`, but:
- Replace inline `<style>` with `<link rel="stylesheet" href="/styles/base.css">` and `<link rel="stylesheet" href="/styles/landing.css">`
- Replace inline `<script>` with `<script type="module" src="/src/main.ts"></script>`
- Add Google Fonts `<link>` in `<head>`

- [ ] **Step 2: Create `frontend/styles/landing.css`**

Extract all landing-specific CSS from the v3 mockup into this file. Keep base tokens in `base.css`. This includes: nav, hero, report-card, partners, commands-grid, pipeline-flow, how-section, pricing-table, footer, animations, responsive breakpoints.

- [ ] **Step 3: Create `frontend/src/main.ts`**

```typescript
// Scroll reveal
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 },
);

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// Stagger pipeline steps
const flowObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const steps = entry.target.querySelectorAll<HTMLElement>(".flow-step");
        steps.forEach((step, i) => {
          setTimeout(() => {
            step.style.opacity = "1";
            step.style.transform = "translateY(0)";
            step.style.transition =
              "opacity 400ms cubic-bezier(0.25,1,0.5,1), transform 400ms cubic-bezier(0.25,1,0.5,1)";
          }, i * 70);
        });
        flowObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.1 },
);

const pipelineFlow = document.querySelector(".pipeline-flow");
if (pipelineFlow) flowObserver.observe(pipelineFlow);
```

- [ ] **Step 4: Verify dev server**

Run: `cd frontend && npm run dev`
Open: `http://localhost:3000`
Expected: Landing page renders with all sections, animations work on scroll.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/styles/landing.css frontend/src/main.ts
git commit -m "feat(frontend): add landing page with all sections"
```

---

### Task 4: Dashboard — HTML + CSS

**Files:**
- Create: `frontend/app.html`
- Create: `frontend/styles/dashboard.css`

- [ ] **Step 1: Create `frontend/app.html`**

Full dashboard HTML from the approved dashboard-v2 mockup. Structure:
- `<div class="topbar">` — logo, nav, balance, address
- `<div class="main">` with:
  - `.search-area` — command tabs, input, button
  - `#report` container (initially hidden, populated by JS)
  - `#history` — query history table

Links:
```html
<link rel="stylesheet" href="/styles/base.css">
<link rel="stylesheet" href="/styles/dashboard.css">
<script type="module" src="/src/app.ts"></script>
```

The `#report` div starts empty — `render.ts` fills it after a query. Include a placeholder state:
```html
<div id="report">
  <div class="empty-state">
    <p>Enter a wallet address and pick a command to start.</p>
  </div>
</div>
```

- [ ] **Step 2: Create `frontend/styles/dashboard.css`**

Extract all dashboard-specific CSS from the dashboard-v2 mockup. Includes: topbar, search area, command tabs, stats row, report body, analysis, sidebar, allocation list, defi list, pnl grid, transaction table, badges, history table, responsive breakpoints.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run dev`
Open: `http://localhost:3000/app.html`
Expected: Dashboard renders with search area, empty state, and static layout.

- [ ] **Step 4: Commit**

```bash
git add frontend/app.html frontend/styles/dashboard.css
git commit -m "feat(frontend): add dashboard page with layout and styles"
```

---

### Task 5: API client

**Files:**
- Create: `frontend/src/api.ts`

- [ ] **Step 1: Create `frontend/src/api.ts`**

```typescript
export type Command = "quick" | "research" | "pnl" | "defi" | "history" | "nft" | "compare";

export const COMMAND_PRICES: Record<Command, string> = {
  quick: "$0.01",
  research: "$0.05",
  pnl: "$0.02",
  defi: "$0.02",
  history: "$0.02",
  nft: "$0.02",
  compare: "$0.05",
};

export interface ApiError {
  error: string;
}

export async function query<T>(command: Command, body: Record<string, string>): Promise<T> {
  const res = await fetch(`/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // x402 payment required — show price info
    if (res.status === 402) {
      throw new Error(`Payment required: ${COMMAND_PRICES[command]} USDC on Base`);
    }
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as ApiError;
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

Note: x402 payment integration with `@x402/fetch` is deferred — for the hackathon demo, the API either works without payment middleware or returns 402. The frontend shows the error. Full wallet-based payment flow can be added post-hackathon.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(frontend): add API client for all commands"
```

---

### Task 6: Report rendering

**Files:**
- Create: `frontend/src/render.ts`

- [ ] **Step 1: Create `frontend/src/render.ts`**

Functions that take API response JSON and return HTML strings for each report type:

```typescript
import type { Command } from "./api.ts";

function usd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

// ── Research report (full) ──

interface ResearchData {
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
}

export function renderResearch(report: ResearchData): string {
  const { address, data, analysis } = report;
  const risk = analysis.riskLevel;
  const riskClass = risk === "low" ? "badge-low" : risk === "high" ? "badge-high" : "badge-med";

  const positions = data.topPositions;
  const colors = [
    "oklch(35% 0.08 250)", "oklch(50% 0.1 160)", "oklch(55% 0.12 310)",
    "oklch(58% 0.1 40)", "oklch(65% 0.06 70)",
  ];

  const allocItems = positions.slice(0, 5).map((p, i) => `
    <li class="alloc-item">
      <span class="alloc-asset"><span class="alloc-dot" style="background:${colors[i] ?? colors[4]}"></span>${escapeHtml(p.asset)}</span>
      <span class="alloc-value">$${usd(p.valueUsd)}</span>
      <span class="alloc-pct">${p.percentage}%</span>
    </li>
  `).join("");

  const patternTags = analysis.patterns.map((p) =>
    `<div class="tag-item">${escapeHtml(p)}</div>`
  ).join("");

  const chainTags = data.chains.map((c) =>
    `<span class="chain-tag">${escapeHtml(c)}</span>`
  ).join("");

  const cleanSummary = analysis.summary
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p>${escapeHtml(l.trim())}</p>`)
    .join("");

  return `
    <div class="report-top">
      <div class="report-wallet">
        <h2>${shortAddr(address)} <span class="addr-full">${escapeHtml(address)}</span></h2>
        <div class="badges">
          <span class="badge ${riskClass}">${risk} risk</span>
          ${data.isSmartMoney ? '<span class="badge badge-smart">Smart money</span>' : ""}
        </div>
      </div>
      <span class="report-timestamp">${new Date(report.timestamp).toLocaleString()}</span>
    </div>

    <div class="stats-row">
      <div class="stat"><div class="stat-label">Portfolio</div><div class="stat-value">$${usd(data.totalValueUsd)}</div><div class="stat-sub">across ${data.chains.length} chains</div></div>
      <div class="stat"><div class="stat-label">Positions</div><div class="stat-value">${data.positionCount}</div><div class="stat-sub">filtered</div></div>
      <div class="stat"><div class="stat-label">Risk</div><div class="stat-value ${risk === "low" ? "green" : ""}">${risk.charAt(0).toUpperCase() + risk.slice(1)}</div></div>
      <div class="stat"><div class="stat-label">Top holding</div><div class="stat-value">${positions[0]?.asset ?? "—"}</div><div class="stat-sub">${positions[0]?.percentage ?? 0}%</div></div>
      <div class="stat"><div class="stat-label">Smart money</div><div class="stat-value">${data.isSmartMoney ? "Yes" : "No"}</div></div>
    </div>

    <div class="report-body">
      <div>
        <div class="section-title">Analysis</div>
        <div class="analysis-text">${cleanSummary}</div>
        <div class="verdict-box"><strong>Verdict</strong>${escapeHtml(analysis.verdict)}</div>
      </div>
      <div class="sidebar">
        <div><div class="section-title">Allocation</div><ul class="alloc-list">${allocItems}</ul></div>
        ${patternTags ? `<div><div class="section-title">Detected patterns</div><div class="tag-list">${patternTags}</div></div>` : ""}
        ${chainTags ? `<div><div class="section-title">Active chains</div><div class="chain-row">${chainTags}</div></div>` : ""}
      </div>
    </div>
  `;
}

// ── Quick report ──

interface QuickData {
  address: string;
  portfolio: { totalValueUsd: number; chains: string[]; change24hPercent: number; change24hUsd: number };
  topPositions: { asset: string; valueUsd: number; percentage: number }[];
}

export function renderQuick(report: QuickData): string {
  const { address, portfolio, topPositions } = report;
  const sign = portfolio.change24hPercent >= 0 ? "+" : "";
  const changeClass = portfolio.change24hPercent >= 0 ? "green" : "";

  const positions = topPositions.map((p) => `
    <li class="alloc-item">
      <span class="alloc-asset">${escapeHtml(p.asset)}</span>
      <span class="alloc-value">$${usd(p.valueUsd)}</span>
      <span class="alloc-pct">${p.percentage}%</span>
    </li>
  `).join("");

  return `
    <div class="report-top">
      <div class="report-wallet"><h2>Quick Snapshot <span class="addr-full">${escapeHtml(address)}</span></h2></div>
    </div>
    <div class="stats-row" style="grid-template-columns: repeat(3, 1fr);">
      <div class="stat"><div class="stat-label">Portfolio</div><div class="stat-value">$${usd(portfolio.totalValueUsd)}</div></div>
      <div class="stat"><div class="stat-label">24h change</div><div class="stat-value ${changeClass}">${sign}${(portfolio.change24hPercent * 100).toFixed(1)}%</div></div>
      <div class="stat"><div class="stat-label">Chains</div><div class="stat-value">${portfolio.chains.length}</div></div>
    </div>
    <div><div class="section-title">Top positions</div><ul class="alloc-list">${positions}</ul></div>
  `;
}

// ── PnL report ──

interface PnlData {
  address: string;
  pnl: { realizedGain: number; unrealizedGain: number; totalFees: number; netInvested: number };
  roi: number;
}

export function renderPnl(report: PnlData): string {
  const { address, pnl, roi } = report;
  const roiClass = roi >= 0 ? "up" : "down";
  const sign = (v: number): string => v >= 0 ? "+" : "";

  return `
    <div class="report-top">
      <div class="report-wallet"><h2>Profit & Loss <span class="addr-full">${escapeHtml(address)}</span></h2></div>
    </div>
    <div class="stats-row" style="grid-template-columns: repeat(2, 1fr);">
      <div class="stat"><div class="stat-label">ROI</div><div class="stat-value ${roiClass}">${sign(roi)}${roi.toFixed(1)}%</div></div>
      <div class="stat"><div class="stat-label">Net invested</div><div class="stat-value">$${usd(Math.abs(pnl.netInvested))}</div></div>
    </div>
    <div class="pnl-grid">
      <div class="pnl-item"><div class="l">Realized gain</div><div class="v ${pnl.realizedGain >= 0 ? "up" : "down"}">${sign(pnl.realizedGain)}$${usd(Math.abs(pnl.realizedGain))}</div></div>
      <div class="pnl-item"><div class="l">Unrealized gain</div><div class="v ${pnl.unrealizedGain >= 0 ? "up" : "down"}">${sign(pnl.unrealizedGain)}$${usd(Math.abs(pnl.unrealizedGain))}</div></div>
      <div class="pnl-item"><div class="l">Total fees</div><div class="v down">-$${usd(Math.abs(pnl.totalFees))}</div></div>
      <div class="pnl-item"><div class="l">Net invested</div><div class="v">$${usd(Math.abs(pnl.netInvested))}</div></div>
    </div>
  `;
}

// ── DeFi report ──

interface DefiData {
  address: string;
  positions: { protocol: string; type: string; asset: string; valueUsd: number; chain: string }[];
  totalDefiUsd: number;
}

export function renderDefi(report: DefiData): string {
  const { address, positions, totalDefiUsd } = report;

  if (positions.length === 0) {
    return `
      <div class="report-top"><div class="report-wallet"><h2>DeFi Positions <span class="addr-full">${escapeHtml(address)}</span></h2></div></div>
      <div class="empty-state"><p>No DeFi positions found.</p></div>
    `;
  }

  const items = positions.map((p) => `
    <li class="defi-item">
      <div><span class="defi-proto">${escapeHtml(p.protocol)}</span><br><span class="defi-type">${escapeHtml(p.type)} · ${escapeHtml(p.asset)}</span></div>
      <span class="defi-val">$${usd(p.valueUsd)}</span>
    </li>
  `).join("");

  return `
    <div class="report-top">
      <div class="report-wallet"><h2>DeFi Positions <span class="addr-full">${escapeHtml(address)}</span></h2></div>
    </div>
    <div class="stats-row" style="grid-template-columns: repeat(2, 1fr);">
      <div class="stat"><div class="stat-label">Total DeFi</div><div class="stat-value">$${usd(totalDefiUsd)}</div></div>
      <div class="stat"><div class="stat-label">Protocols</div><div class="stat-value">${new Set(positions.map((p) => p.protocol)).size}</div></div>
    </div>
    <div><div class="section-title">Positions</div><ul class="defi-list">${items}</ul></div>
  `;
}

// ── History report ──

interface HistoryData {
  address: string;
  transactions: { type: string; timestamp: string; chain: string; transfers: { direction: string; symbol: string; quantity: number; valueUsd: number }[] }[];
  pattern: { trades: number; receives: number; sends: number; executes: number; other: number };
  frequency: string;
}

export function renderHistory(report: HistoryData): string {
  const { address, transactions, pattern, frequency } = report;

  const typeClass: Record<string, string> = { trade: "txn-trade", receive: "txn-receive", send: "txn-send", execute: "txn-execute" };

  const rows = transactions.slice(0, 10).map((tx) => {
    const details = tx.transfers.map((t) => `${t.quantity.toFixed(4)} ${t.symbol}`).join(", ") || "contract call";
    const cls = typeClass[tx.type] ?? "";
    const time = new Date(tx.timestamp).toLocaleString();
    return `<tr><td><span class="txn-type ${cls}">${escapeHtml(tx.type)}</span></td><td>${escapeHtml(details)}</td><td>${escapeHtml(tx.chain)}</td><td style="color:var(--ink-3)">${time}</td></tr>`;
  }).join("");

  const patternParts = Object.entries(pattern).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ");

  return `
    <div class="report-top">
      <div class="report-wallet"><h2>Transaction History <span class="addr-full">${escapeHtml(address)}</span></h2></div>
      <span class="report-timestamp">${escapeHtml(frequency)}</span>
    </div>
    <div class="stats-row" style="grid-template-columns: repeat(2, 1fr);">
      <div class="stat"><div class="stat-label">Transactions</div><div class="stat-value">${transactions.length}</div></div>
      <div class="stat"><div class="stat-label">Pattern</div><div class="stat-value" style="font-size:0.9rem">${escapeHtml(patternParts)}</div></div>
    </div>
    <table><thead><tr><th>Type</th><th>Details</th><th>Chain</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>
  `;
}

// ── NFT report ──

interface NftData {
  address: string;
  collections: { name: string; count: number; floorPrice: number; chain: string }[];
  totalEstimatedUsd: number;
}

export function renderNft(report: NftData): string {
  const { address, collections, totalEstimatedUsd } = report;

  if (collections.length === 0) {
    return `
      <div class="report-top"><div class="report-wallet"><h2>NFT Portfolio <span class="addr-full">${escapeHtml(address)}</span></h2></div></div>
      <div class="empty-state"><p>No NFT collections found.</p></div>
    `;
  }

  const rows = collections.map((c) =>
    `<tr><td>${escapeHtml(c.name)}</td><td>${c.count}</td><td>$${usd(c.floorPrice)}</td><td>${escapeHtml(c.chain)}</td></tr>`
  ).join("");

  return `
    <div class="report-top">
      <div class="report-wallet"><h2>NFT Portfolio <span class="addr-full">${escapeHtml(address)}</span></h2></div>
    </div>
    <div class="stats-row" style="grid-template-columns: repeat(2, 1fr);">
      <div class="stat"><div class="stat-label">Estimated value</div><div class="stat-value">$${usd(totalEstimatedUsd)}</div></div>
      <div class="stat"><div class="stat-label">Collections</div><div class="stat-value">${collections.length}</div></div>
    </div>
    <table><thead><tr><th>Collection</th><th>Count</th><th>Floor</th><th>Chain</th></tr></thead><tbody>${rows}</tbody></table>
  `;
}

// ── Compare report ──

interface CompareData {
  addressA: string;
  addressB: string;
  a: { portfolio: QuickData["portfolio"]; positions: QuickData["topPositions"]; pnl: PnlData["pnl"] };
  b: { portfolio: QuickData["portfolio"]; positions: QuickData["topPositions"]; pnl: PnlData["pnl"] };
  verdict: string;
}

export function renderCompare(report: CompareData): string {
  const { addressA, addressB, a, b, verdict } = report;
  const roiA = a.pnl.netInvested !== 0 ? ((a.pnl.realizedGain + a.pnl.unrealizedGain) / Math.abs(a.pnl.netInvested)) * 100 : 0;
  const roiB = b.pnl.netInvested !== 0 ? ((b.pnl.realizedGain + b.pnl.unrealizedGain) / Math.abs(b.pnl.netInvested)) * 100 : 0;

  return `
    <div class="report-top">
      <div class="report-wallet"><h2>Compare <span class="addr-full">${shortAddr(addressA)} vs ${shortAddr(addressB)}</span></h2></div>
    </div>
    <table>
      <thead><tr><th>Metric</th><th>${shortAddr(addressA)}</th><th>${shortAddr(addressB)}</th></tr></thead>
      <tbody>
        <tr><td>Portfolio</td><td>$${usd(a.portfolio.totalValueUsd)}</td><td>$${usd(b.portfolio.totalValueUsd)}</td></tr>
        <tr><td>Chains</td><td>${a.portfolio.chains.length}</td><td>${b.portfolio.chains.length}</td></tr>
        <tr><td>ROI</td><td class="${roiA >= 0 ? "green" : ""}">${roiA >= 0 ? "+" : ""}${roiA.toFixed(1)}%</td><td class="${roiB >= 0 ? "green" : ""}">${roiB >= 0 ? "+" : ""}${roiB.toFixed(1)}%</td></tr>
        <tr><td>Top asset</td><td>${a.positions[0]?.asset ?? "—"}</td><td>${b.positions[0]?.asset ?? "—"}</td></tr>
      </tbody>
    </table>
    <div class="verdict-box" style="margin-top: 24px;"><strong>Verdict</strong>${escapeHtml(verdict)}</div>
  `;
}

// ── Router ──

const renderers: Record<Command, (data: unknown) => string> = {
  research: (d) => renderResearch(d as ResearchData),
  quick: (d) => renderQuick(d as QuickData),
  pnl: (d) => renderPnl(d as PnlData),
  defi: (d) => renderDefi(d as DefiData),
  history: (d) => renderHistory(d as HistoryData),
  nft: (d) => renderNft(d as NftData),
  compare: (d) => renderCompare(d as CompareData),
};

export function renderReport(command: Command, data: unknown): string {
  const renderer = renderers[command];
  return renderer(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/render.ts
git commit -m "feat(frontend): add report renderers for all 7 commands"
```

---

### Task 7: Dashboard interactivity

**Files:**
- Create: `frontend/src/app.ts`

- [ ] **Step 1: Create `frontend/src/app.ts`**

```typescript
import { query, COMMAND_PRICES, type Command } from "./api.ts";
import { renderReport } from "./render.ts";

// ── State ──
let activeCommand: Command = "research";

interface HistoryEntry {
  command: Command;
  address: string;
  resultSummary: string;
  cost: string;
  timestamp: Date;
}

const historyEntries: HistoryEntry[] = [];

// ── DOM refs ──
const reportEl = document.getElementById("report")!;
const searchBtn = document.getElementById("searchBtn") as HTMLButtonElement;
const addrInput = document.getElementById("addrInput") as HTMLInputElement;
const historyBody = document.getElementById("historyBody") as HTMLTableSectionElement | null;

// ── Command tab switching ──
document.querySelectorAll<HTMLButtonElement>(".cmd-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".cmd-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeCommand = tab.dataset.cmd as Command;
    const price = COMMAND_PRICES[activeCommand];
    const label = activeCommand.charAt(0).toUpperCase() + activeCommand.slice(1);
    searchBtn.textContent = `${label} · ${price}`;

    if (activeCommand === "compare") {
      addrInput.placeholder = "0xaddr1 0xaddr2";
    } else {
      addrInput.placeholder = "0x...";
    }
  });
});

// ── Search ──
async function executeSearch(): Promise<void> {
  const input = addrInput.value.trim();
  const addresses = input.match(/0x[a-fA-F0-9]{40}/g);

  if (activeCommand === "compare") {
    if (!addresses || addresses.length < 2) {
      reportEl.innerHTML = '<div class="empty-state"><p>Enter two valid wallet addresses to compare.</p></div>';
      return;
    }
  } else {
    if (!addresses || addresses.length === 0) {
      reportEl.innerHTML = '<div class="empty-state"><p>Enter a valid wallet address (0x...).</p></div>';
      return;
    }
  }

  // Loading state
  searchBtn.disabled = true;
  searchBtn.textContent = "Loading...";
  reportEl.innerHTML = '<div class="empty-state"><p>Fetching data...</p></div>';

  try {
    const body = activeCommand === "compare"
      ? { addressA: addresses![0], addressB: addresses![1] }
      : { address: addresses![0] };

    const data = await query(activeCommand, body);
    reportEl.innerHTML = renderReport(activeCommand, data);

    // Add to history
    addToHistory(activeCommand, addresses![0], data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    reportEl.innerHTML = `<div class="empty-state"><p style="color: var(--danger);">Error: ${msg}</p></div>`;
  } finally {
    searchBtn.disabled = false;
    const label = activeCommand.charAt(0).toUpperCase() + activeCommand.slice(1);
    searchBtn.textContent = `${label} · ${COMMAND_PRICES[activeCommand]}`;
  }
}

searchBtn.addEventListener("click", executeSearch);
addrInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") executeSearch();
});

// ── History ──
function addToHistory(command: Command, address: string, data: unknown): void {
  let resultSummary = "";
  try {
    const d = data as Record<string, unknown>;
    if (d.data && typeof d.data === "object") {
      const dd = d.data as Record<string, unknown>;
      resultSummary = `$${Number(dd.totalValueUsd ?? 0).toLocaleString()}`;
    } else if (d.portfolio && typeof d.portfolio === "object") {
      const p = d.portfolio as Record<string, unknown>;
      resultSummary = `$${Number(p.totalValueUsd ?? 0).toLocaleString()}`;
    } else if (d.pnl && typeof d.pnl === "object") {
      const roi = Number(d.roi ?? 0);
      resultSummary = `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% ROI`;
    } else if (d.totalDefiUsd != null) {
      resultSummary = `$${Number(d.totalDefiUsd).toLocaleString()} DeFi`;
    } else if (d.totalEstimatedUsd != null) {
      resultSummary = `$${Number(d.totalEstimatedUsd).toLocaleString()} NFTs`;
    } else {
      resultSummary = "Done";
    }
  } catch {
    resultSummary = "Done";
  }

  historyEntries.unshift({
    command,
    address,
    resultSummary,
    cost: COMMAND_PRICES[command],
    timestamp: new Date(),
  });

  renderHistory();
}

function renderHistory(): void {
  if (!historyBody) return;

  historyBody.innerHTML = historyEntries.slice(0, 10).map((entry) => `
    <tr>
      <td><span class="mono">/${entry.command}</span></td>
      <td><span class="mono">${entry.address.slice(0, 6)}...${entry.address.slice(-4)}</span></td>
      <td>${entry.resultSummary}</td>
      <td>${entry.cost}</td>
      <td style="color: var(--ink-3);">${entry.timestamp.toLocaleTimeString()}</td>
    </tr>
  `).join("");
}
```

- [ ] **Step 2: Update `app.html` command tabs with `data-cmd` attributes**

Each `.cmd-tab` button needs a `data-cmd` attribute:
```html
<button class="cmd-tab" data-cmd="quick">/quick <span class="price">$0.01</span></button>
<button class="cmd-tab active" data-cmd="research">/research <span class="price">$0.05</span></button>
<button class="cmd-tab" data-cmd="pnl">/pnl <span class="price">$0.02</span></button>
<button class="cmd-tab" data-cmd="defi">/defi <span class="price">$0.02</span></button>
<button class="cmd-tab" data-cmd="history">/history <span class="price">$0.02</span></button>
<button class="cmd-tab" data-cmd="nft">/nft <span class="price">$0.02</span></button>
<button class="cmd-tab" data-cmd="compare">/compare <span class="price">$0.05</span></button>
```

Add history table with `id="historyBody"` on `<tbody>`.

- [ ] **Step 3: Verify**

Run: `cd frontend && npm run dev` (with backend running on :4000)
Open: `http://localhost:3000/app.html`
Test: Select a command, enter an address, click button. Report should render (or show 402 error if payment middleware is active).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app.ts frontend/app.html
git commit -m "feat(frontend): add dashboard interactivity and search"
```

---

### Task 8: Express static file serving

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add static file serving to Express**

Add before the route registrations in `src/index.ts`:

```typescript
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, "..", "frontend", "dist");
```

Add after all API routes are registered:

```typescript
// Serve frontend static files
app.use(express.static(frontendDist));

// SPA fallback — serve index.html for unmatched GET requests
app.get("*", (_req, res) => {
  res.sendFile(join(frontendDist, "index.html"));
});
```

- [ ] **Step 2: Add build script to root `package.json`**

Add to scripts in root `package.json`:
```json
"build:frontend": "cd frontend && npm run build",
"build": "cd frontend && npm run build"
```

- [ ] **Step 3: Build and verify**

Run: `cd frontend && npm run build`
Expected: `frontend/dist/` created with `index.html`, `app.html`, bundled JS/CSS.

Run: `cd .. && npm run dev`
Open: `http://localhost:4000` → landing page
Open: `http://localhost:4000/app.html` → dashboard

- [ ] **Step 4: Add `frontend/dist/` to `.gitignore`**

Append to `.gitignore`:
```
frontend/dist/
frontend/node_modules/
```

- [ ] **Step 5: Commit**

```bash
git add src/index.ts package.json .gitignore
git commit -m "feat: serve frontend static files from Express"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npm run build`

- [ ] **Step 2: Start server**

Run: `cd .. && npm run dev`

- [ ] **Step 3: Verify landing page**

Open: `http://localhost:4000`
Check:
- All sections render (hero, commands, pipeline, how, pricing, footer)
- Scroll animations trigger
- "Launch app" button navigates to `/app.html`
- Responsive at mobile widths

- [ ] **Step 4: Verify dashboard**

Open: `http://localhost:4000/app.html`
Check:
- Command tabs switch correctly
- Search button label updates with command name + price
- Address input works
- Submitting a query calls the API (may get 402 — that's expected if x402 middleware is active)
- Report renders for successful queries
- History table populates

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(frontend): complete landing + dashboard frontend"
```
