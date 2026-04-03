# Intelligence Wire

**5 autonomous AI agents that collect on-chain intelligence, analyze it with LLM, and sell actionable signals via x402 micropayments.**

Built for OWS Hackathon — April 3, 2026

## Architecture

```
Allium WS --> Scanner --> Enricher (Zerion) --> Analyst (LLM) --> Distributor (XMTP DM)
                                                     |
                                                     +--> Trader (Myriad + DFlow + MoonPay + Ripple)
```

5 separate Node.js processes, each with its own wallet. Agents communicate via encrypted message bus. External clients pay for signals via x402 micropayments.

## Partner Integrations (9/10)

| Partner | Agent | Usage |
|---------|-------|-------|
| **Allium** | Scanner | Real-time blockchain event streaming |
| **Uniblock** | Scanner | Cross-chain data verification |
| **Zerion** | Enricher | Smart money portfolio analysis |
| **XMTP** | All | Encrypted agent-to-agent messaging protocol |
| **x402** | Analyst | Pay-per-request signal API ($0.01/query) |
| **OWS** | All | Wallet identity per agent |
| **Myriad** | Trader | Prediction market trading |
| **DFlow** | Trader | Order flow auction quotes |
| **MoonPay** | Trader | Cross-chain bridges and swaps |
| **Ripple** | Trader | XRPL cross-border payment demo |

## Quick Start

```bash
# Install
npm install

# Generate wallet keys for all 5 agents
npx tsx setup-wallets.ts

# Launch everything (5 agents + dashboard)
./start.sh
```

**Dashboard:** http://localhost:3000

## Individual Agents

| Agent | Port | Role |
|-------|------|------|
| Scanner | 4001 | Allium streaming + whale detection |
| Enricher | 4002 | Zerion portfolio enrichment |
| Analyst | 4003 | LLM analysis + x402 paid API |
| Distributor | 4004 | XMTP DM alerts to subscribers |
| Trader | 4005 | Multi-platform trading execution |

## x402 Paid API

The Analyst agent exposes paid endpoints on Base Sepolia:

```
GET http://localhost:4003/api/signals        # $0.01 — latest signals
GET http://localhost:4003/api/signals/latest  # $0.005 — single latest
GET http://localhost:4003/api/history         # $0.05 — 24h history
```

## Data Flow

1. **Scanner** detects whale transactions via Allium real-time streaming
2. **Enricher** profiles the whale wallet via Zerion API (portfolio, positions, smart money score)
3. **Analyst** generates BUY/SELL/WATCH signals using LLM analysis (OpenRouter)
4. **Distributor** broadcasts signals to subscribers via encrypted XMTP DMs
5. **Trader** executes on Myriad prediction markets, DFlow auctions, MoonPay bridges, Ripple cross-border

## Environment Variables

Copy `.env.example` to `.env` and fill in API keys:

```bash
cp .env.example .env
npx tsx setup-wallets.ts  # Auto-generates wallet + DB keys
```

Optional API keys (system works in mock mode without them):
- `ALLIUM_API_KEY` — Real-time blockchain streaming
- `ZERION_API_KEY` — Portfolio data
- `OPENROUTER_API_KEY` — LLM analysis
- `UNIBLOCK_API_KEY` — Cross-chain data

## Tech Stack

TypeScript, Node.js 22, Express, React 19, Vite 6, viem
