# OWS Intelligence Wire — Frontend Design Spec

## Overview

Frontend for OWS Intelligence Wire v2 — landing page + interactive dashboard. Serves the existing Express backend (7 analytics commands via x402 micropayments).

## Pages

### 1. Landing Page (`/`)

Single-page marketing site with scroll sections:

- **Nav**: sticky, backdrop-blur. Logo (uppercase "INTELLIGENCE WIRE"), links (Commands, Pipeline, Pricing), pill CTA "Launch app"
- **Hero**: asymmetric 2-column. Left: display heading ("On-chain intelligence, *wired to you.*"), subtitle, CTA buttons, meta stats (7 commands, <10s, x402). Right: live report card preview showing portfolio, 24h change, ROI, allocation bar, DeFi positions, verdict
- **Partners strip**: OWS, x402, XMTP, Zerion, OpenRouter, Base — muted logos
- **Commands grid**: 3x2+1 grid. Each cell: `/command` name (mono), description, price. All 7 commands
- **Pipeline**: 5-step horizontal flow (Payment → Portfolio → Positions → Analysis → Report) with provider tags
- **How it works**: 3 editorial rows (REST API, XMTP DM, Web Dashboard) with numbered steps
- **Pricing table**: all 7 commands with description and price
- **Footer**: logo, links

### 2. Dashboard (`/app`)

Interactive research interface:

- **Topbar**: sticky. Logo, nav tabs (Research/History/API Docs), USDC balance, connected wallet address
- **Search area**: command tabs (/quick $0.01 through /compare $0.05), address input, submit button with dynamic label
- **Report view** (after query):
  - Header: ENS name + full address, badges (risk level, smart money)
  - Stats row: 5 blocks (Portfolio, 24h change, ROI, DeFi deployed, Wallet type)
  - Body: 2-column. Left = analysis text + PnL grid + verdict + recent transactions. Right = allocation list + DeFi positions + patterns + chains
- **Query history table**: command, address, result summary, cost, timestamp

## Visual System

- **Palette**: warm sand/cream (oklch 96.5% base), tinted neutrals, earthy green accent — matching OWS Hackathon site
- **Typography**: Newsreader (serif, display/headings) + Instrument Sans (body). Monospace for addresses/commands
- **Spacing**: 4pt base system
- **Borders**: 1px solid sand-2, radius 2px. No cards-in-cards, no shadows, no glassmorphism
- **Motion**: staggered entrance (translateY + opacity), scroll-triggered reveals, reduced-motion respected

## Tech Stack

- **Vite** + vanilla TypeScript — no React needed, pages are mostly static with fetch calls
- **Single repo** — frontend lives in `frontend/` directory
- **Express serves** static files from `frontend/dist/` in production
- **API calls**: browser fetches `/quick`, `/research`, etc. with x402 payment headers
- **Wallet connection**: viem for connecting wallet, signing x402 payments

## API Integration

Dashboard calls the existing Express endpoints:
- `POST /quick` → QuickReport JSON
- `POST /research` → ResearchReport JSON
- `POST /pnl` → PnlReport JSON
- `POST /defi` → DefiReport JSON
- `POST /history` → HistoryReport JSON
- `POST /nft` → NftReport JSON
- `POST /compare` → CompareReport JSON

x402 payment handled via `@x402/fetch` in the browser — wraps fetch with automatic USDC payment.

## File Structure

```
frontend/
├── index.html          # Landing page
├── app.html            # Dashboard
├── src/
│   ├── main.ts         # Landing page JS (scroll reveals, animations)
│   ├── app.ts          # Dashboard JS (search, API calls, rendering)
│   ├── api.ts          # API client with x402 payment
│   ├── render.ts       # Report rendering functions
│   └── wallet.ts       # Wallet connection (viem)
├── styles/
│   ├── base.css        # Variables, reset, typography
│   ├── landing.css     # Landing page styles
│   └── dashboard.css   # Dashboard styles
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Scope Boundaries

- No auth/login — wallet connection only for payments
- No local storage of reports — stateless, query-and-view
- No real-time updates — static report after query
- No mobile app — responsive web only
- Compare view reuses the same report layout (side-by-side on desktop, stacked on mobile)
