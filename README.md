# Dossier

**On-chain wallet intelligence agent. 14 commands — analytics, token actions, and monitoring.**

Pay-per-call via x402 USDC micropayments on Base. Three interfaces: Web Dashboard, XMTP encrypted chat, and CLI.

Built for OWS Hackathon — April 3, 2026 | Track 3: Pay-Per-Call Services

---

## How It Works

```
                    ┌─────────────────────────────────────┐
                    │             Dossier                  │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
       ┌──────┴──────┐     ┌──────┴──────┐     ┌───────┴───────┐
       │  Dashboard   │     │  XMTP Chat  │     │   CLI Client   │
       │  (React app) │     │  (encrypted │     │  (interactive  │
       │              │     │   DM agent) │     │   terminal)    │
       └──────┬──────┘     └──────┬──────┘     └───────┬───────┘
              │                    │                     │
              └────────────────────┼─────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │     Express REST API          │
                    │     x402 payment middleware   │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
       ┌──────┴──────┐     ┌──────┴──────┐     ┌───────┴───────┐
       │  Zerion API  │     │  OpenRouter  │     │  OWS Wallet   │
       │  portfolio   │     │  LLM (AI)    │     │  sign & send  │
       │  DeFi, NFTs  │     │  analysis    │     │  transactions │
       │  swap/bridge │     │              │     │               │
       └─────────────┘     └─────────────┘     └───────────────┘
```

**Payment flow:** every paid command costs $0.01–$0.10 USDC. The x402 protocol handles payment verification automatically — the caller signs a USDC authorization, the facilitator verifies it, and only then does the server execute the request.

---

## Three Ways to Use It

### 1. Web Dashboard

**Live:** [dossier.up.railway.app](https://dossier.up.railway.app)

Select a command, enter a wallet address, and get visual reports.

The dashboard uses an **API proxy** — your OWS client wallet pays x402 on your behalf through the `/api/*` routes, so you don't need to handle payment headers manually.

**Features:**
- All 14 commands with tailored input forms
- OWS wallet connection (top-right)
- Skeleton loading states with step indicators
- GSAP-animated report transitions
- Query history tracking
- Responsive sand/cream editorial design

**To use:**
```bash
# Start the server (serves frontend from frontend/dist)
npm run dev

# Or run frontend in dev mode with hot reload
cd frontend && npm run dev   # → http://localhost:5173 (proxies API to :4000)
```

### 2. XMTP Encrypted Chat

DM the agent's XMTP address from any XMTP-compatible wallet (Converse, xmtp.chat, etc.). All messages are end-to-end encrypted.

**Agent address:** `0x379cf10f35950dDc581940EDD4dCBD16Dd226518`

**How it works:**
1. Send a command, e.g. `/research 0xd8dA...96045`
2. For paid commands — the agent sends a payment request via `wallet_sendCalls`
3. Approve the USDC payment in your wallet
4. The agent processes the request and replies with a formatted report
5. For wallet actions (swap/send/bridge) — you get a confirmation step before execution

**Example conversation:**
```
You:   /quick 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
Agent: [payment request — $0.01 USDC]
You:   [approve in wallet]
Agent: 📊 Portfolio Snapshot
       Total: $2.4M across 4 chains
       Top: ETH ($1.8M, 75%), USDC ($320K, 13%), ...
       24h change: +2.3%
```

Send `/help` to see all available commands.

### 3. CLI Client

Interactive terminal client that connects to the agent via XMTP. Uses a separate OWS wallet (`client-researcher`) to pay for queries.

```bash
npm run client
```

**CLI prompt:**
```
Dossier CLI (OWS wallet: client-researcher)

> /research 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
⏳ Sending to agent...
💰 Payment request received — approve? (pay / cancel)
> pay
✅ Payment sent
📊 Report:
   ...

> /balance
   ETH: 0.05 ($160)
   USDC: 12.50 ($12.50)
   Total: $172.50

> quit
```

---

## All 14 Commands

### Analytics (Zerion data + AI analysis)

| Command | Price | Description |
|---------|-------|-------------|
| `/quick 0x<addr>` | $0.01 | Portfolio snapshot — total value, top 3 positions, chains, 24h change |
| `/research 0x<addr>` | $0.05 | Deep AI report — portfolio, DeFi, PnL, transactions + LLM analysis with risk assessment |
| `/pnl 0x<addr>` | $0.02 | Profit & loss — realized/unrealized gains, ROI, total fees |
| `/defi 0x<addr>` | $0.02 | DeFi positions — staked, deposited, locked, rewards by protocol |
| `/history 0x<addr>` | $0.02 | Transaction history — last 20 txns, activity patterns, frequency |
| `/nft 0x<addr>` | $0.02 | NFT collections — holdings, floor prices, chain distribution |
| `/compare 0x<a> 0x<b>` | $0.05 | Side-by-side wallet comparison with AI verdict |

### Wallet Actions (via Zerion aggregator + OWS signing)

| Command | Price | Description |
|---------|-------|-------------|
| `/balance` | Free | Your wallet's token balances and total USD value |
| `/swap <amt> <token> to <token>` | $0.01 | DEX swap offer via Zerion aggregator (best route across DEXes) |
| `/bridge <amt> <token> from <chain> to <chain>` | $0.01 | Cross-chain bridge quote and execution |
| `/send <amt> <token> to 0x<addr>` | $0.01 | Token transfer to any address |

**Supported chains:** Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BSC

### Monitoring (Zerion webhooks → XMTP alerts)

| Command | Price | Description |
|---------|-------|-------------|
| `/watch 0x<addr>` | $0.10 | Start monitoring — receive XMTP alerts on wallet activity |
| `/unwatch 0x<addr>` | Free | Stop monitoring a wallet |
| `/subscribe` | Free | Daily digest opt-in (coming soon) |

When a watched wallet transacts, you get an alert like:
```
🔔 Wallet activity: 0xd8dA...6045
━━━━━━━━━━━━━━━━━━━━━━━━━━
Type: trade
Chain: base
Time: 2026-04-03T14:22:00Z

Transfers:
  → sent 1000 USDC ($1,000.00)
  ← received 0.32 ETH ($960.00)
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js 22, TypeScript, Express 5 |
| **Wallet** | OWS (Open Wallet Standard) — identity, signing, transactions |
| **Payments** | x402 protocol — USDC micropayments on Base mainnet |
| **Facilitator** | Coinbase CDP (api.cdp.coinbase.com/platform/v2/x402) |
| **Chat** | XMTP Agent SDK — end-to-end encrypted DMs |
| **Data** | Zerion API — portfolio, DeFi, PnL, transactions, NFTs, swap/bridge |
| **AI** | OpenRouter — LLM synthesis (wallet analysis, risk assessment) |
| **Frontend** | React 19, React Router 7, Vite, GSAP animations |
| **EVM** | viem — address validation, chain utilities |

---

## Setup

### Prerequisites

- Node.js 22+
- [OWS CLI](https://github.com/open-wallet-standard/ows) installed and configured
- API keys for Zerion and OpenRouter

### Installation

```bash
git clone <repo>
cd ows-intelligence-wire
npm install
cd frontend && npm install && cd ..
```

### Create OWS Wallets

The server needs two wallets:

```bash
# Server wallet — receives x402 payments
ows wallet create research-agent

# Client wallet — used by CLI and dashboard to pay for queries
ows wallet create client-researcher
```

### Environment Variables

Create a `.env` file in the project root:

```env
# ── OWS ──
OWS_WALLET_NAME=research-agent        # Server wallet (receives payments)
OWS_CLIENT_WALLET=client-researcher   # Client wallet (dashboard proxy pays from this)

# ── XMTP ──
DB_ENCRYPTION_KEY=0x...               # 32 bytes hex — XMTP database encryption key
XMTP_ENV=dev                          # "dev" or "production"

# ── APIs ──
ZERION_API_KEY=zk_dev_...             # Zerion portfolio API key
OPENROUTER_API_KEY=sk-or-v1-...       # OpenRouter API key (for AI analysis)

# ── x402 Payments ──
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
CHAIN_NETWORK=eip155:8453             # Base mainnet
CDP_API_KEY_ID=...                    # Coinbase CDP API key ID (optional, for JWT auth)
CDP_API_KEY_SECRET=...                # Coinbase CDP API key secret (optional)

# ── Server ──
PORT=4000
WEBHOOK_URL=https://dossier.up.railway.app/webhook   # Public URL for Zerion webhook callbacks
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OWS_WALLET_NAME` | Yes | Name of the OWS wallet that receives payments |
| `DB_ENCRYPTION_KEY` | Yes | 32-byte hex key for XMTP database encryption |
| `ZERION_API_KEY` | Yes | Zerion API key for all portfolio data |
| `OPENROUTER_API_KEY` | Yes | OpenRouter key for AI-powered analysis |
| `FACILITATOR_URL` | No | x402 facilitator endpoint (defaults to x402.org) |
| `CHAIN_NETWORK` | No | Payment chain (defaults to Base mainnet) |
| `CDP_API_KEY_ID` | No | CDP auth for Coinbase facilitator |
| `CDP_API_KEY_SECRET` | No | CDP auth for Coinbase facilitator |
| `WEBHOOK_URL` | No | Public URL for `/watch` webhook callbacks |
| `PORT` | No | Server port (defaults to 4000) |
| `XMTP_ENV` | No | XMTP network (defaults to "dev") |

### Running

```bash
# Start the server (REST API + XMTP agent + serves frontend)
npm run dev

# In a separate terminal — interactive CLI client
npm run client

# Build frontend for production
npm run build:frontend
```

The server starts:
- REST API on `http://localhost:4000`
- XMTP agent listening for DMs
- Frontend served from `frontend/dist`

---

## REST API Reference

All `POST` endpoints (except `/balance` and `/webhook`) require x402 payment. The payment header is handled automatically by x402 client libraries.

### Analytics

```bash
# Quick portfolio snapshot ($0.01)
curl -X POST http://localhost:4000/quick \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# Deep research with AI ($0.05)
curl -X POST http://localhost:4000/research \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# Profit & loss ($0.02)
curl -X POST http://localhost:4000/pnl \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# DeFi positions ($0.02)
curl -X POST http://localhost:4000/defi \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# Transaction history ($0.02)
curl -X POST http://localhost:4000/history \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# NFT collections ($0.02)
curl -X POST http://localhost:4000/nft \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# Compare two wallets ($0.05)
curl -X POST http://localhost:4000/compare \
  -H 'Content-Type: application/json' \
  -d '{"addressA": "0xd8dA...96045", "addressB": "0x1234...5678"}'
```

### Wallet Actions

```bash
# Balance (free)
curl http://localhost:4000/balance
curl http://localhost:4000/balance?wallet=my-wallet

# Swap tokens ($0.01)
curl -X POST http://localhost:4000/swap \
  -H 'Content-Type: application/json' \
  -d '{"amount": 100, "inputToken": "USDC", "outputToken": "ETH", "chain": "base"}'

# Bridge cross-chain ($0.01)
curl -X POST http://localhost:4000/bridge \
  -H 'Content-Type: application/json' \
  -d '{"amount": 50, "symbol": "USDC", "fromChain": "base", "toChain": "ethereum"}'

# Send tokens ($0.01)
curl -X POST http://localhost:4000/send \
  -H 'Content-Type: application/json' \
  -d '{"amount": 10, "symbol": "USDC", "toAddress": "0x1234...5678", "chain": "base"}'
```

### Monitoring

```bash
# Watch a wallet ($0.10)
curl -X POST http://localhost:4000/watch \
  -H 'Content-Type: application/json' \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'

# Health check
curl http://localhost:4000/health
```

### Dashboard Proxy (`/api/*`)

The dashboard frontend uses `/api/*` routes that proxy to the main API, with the server's OWS client wallet paying x402 automatically:

```
POST /api/quick     → pays x402 → POST /quick
POST /api/research  → pays x402 → POST /research
GET  /api/wallet    → active wallet info
GET  /api/wallets   → list all OWS wallets
POST /api/wallet/connect  → switch active wallet
```

---

## Project Structure

```
ows-intelligence-wire/
├── src/
│   ├── index.ts              # Express server, x402 middleware, all routes
│   ├── xmtp.ts               # XMTP agent — command routing, payment flow
│   ├── client.ts             # Interactive CLI client (XMTP + OWS)
│   ├── api-proxy.ts          # Dashboard API proxy (OWS wallet pays x402)
│   ├── pipeline.ts           # /research orchestrator (Zerion → LLM → report)
│   ├── llm.ts                # OpenRouter LLM — wallet analysis prompts
│   ├── report.ts             # Text report formatting
│   ├── types.ts              # All TypeScript interfaces
│   ├── commands/
│   │   ├── quick.ts          # /quick handler
│   │   ├── pnl.ts            # /pnl handler
│   │   ├── defi.ts           # /defi handler
│   │   ├── history.ts        # /history handler
│   │   ├── nft.ts            # /nft handler
│   │   ├── compare.ts        # /compare handler (dual Zerion + LLM verdict)
│   │   ├── balance.ts        # /balance handler
│   │   ├── swap.ts           # /swap handler (Zerion aggregator)
│   │   ├── bridge.ts         # /bridge handler (cross-chain)
│   │   ├── send.ts           # /send handler (token transfer)
│   │   └── watch.ts          # /watch + /unwatch handlers
│   └── services/
│       ├── zerion.ts         # Zerion API client (cached, retries, all endpoints)
│       ├── ows.ts            # OWS wallet wrapper (info, sign, send)
│       └── webhooks.ts       # Zerion webhook subscription management
├── frontend/
│   ├── src/
│   │   ├── api.ts            # API client with x402 payment routing
│   │   ├── main.tsx          # React entry
│   │   ├── pages/
│   │   │   ├── Landing.tsx   # Landing page
│   │   │   └── Dashboard.tsx # Dashboard with all 14 commands
│   │   ├── components/
│   │   │   ├── Hero.tsx
│   │   │   ├── Nav.tsx
│   │   │   ├── CommandsGrid.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── ReportPreview.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── reports/      # Report renderers per command
│   │   └── styles/
│   │       ├── base.css
│   │       ├── landing.css
│   │       └── dashboard.css
│   ├── package.json
│   └── vite.config.ts
├── package.json
├── tsconfig.json
└── .env
```

---

## How the AI Analysis Works

The `/research` and `/compare` commands use an LLM pipeline:

1. **Data collection** — Zerion API fetches portfolio, DeFi positions, PnL, and transaction history
2. **Prompt construction** — all data is formatted into a structured prompt with analysis framework
3. **LLM call** — OpenRouter API processes the prompt (model: Qwen 3.6 Plus)
4. **JSON parsing** — response is parsed into `{ summary, riskLevel, patterns, verdict }`
5. **Fallback** — if LLM fails after 3 retries, a heuristic analysis is generated from the raw data

The analysis framework covers:
- **Wallet profile** — actor classification (whale, DeFi farmer, trader, holder)
- **Portfolio strategy** — diversification, chain preferences, spot vs DeFi allocation
- **Risk assessment** — concentration risk, volatile asset exposure
- **Notable patterns** — unusual allocations, timing, volumes
- **Smart money verdict** — is this wallet worth following?

---

## x402 Payment Protocol

x402 is an HTTP-native payment protocol. Every paid endpoint returns `402 Payment Required` with payment instructions. The client signs a USDC authorization (EIP-3009 gasless permit), attaches it as a header, and the facilitator verifies + settles the payment.

**Flow:**
```
Client                    Server                  Facilitator (CDP)
  │                         │                           │
  │── POST /research ──────>│                           │
  │<── 402 + payment info ──│                           │
  │                         │                           │
  │ [sign USDC permit]      │                           │
  │                         │                           │
  │── POST /research ──────>│                           │
  │   + X-PAYMENT header    │── verify payment ────────>│
  │                         │<── OK ───────────────────│
  │                         │                           │
  │                         │ [execute research]        │
  │                         │                           │
  │<── 200 + report ────────│── settle payment ────────>│
  │                         │                           │
```

The dashboard bypasses this for the user — the API proxy (`/api/*`) uses the server's OWS client wallet to pay automatically.

---

## OWS Wallet Integration

[Open Wallet Standard](https://github.com/open-wallet-standard/ows) provides:

- **Identity** — the server wallet address receives x402 payments
- **Signing** — `signTypedData` for x402 payment authorizations (EIP-712)
- **Transactions** — `signAndSendTx` for swap/bridge/send execution

Two wallets are used:
- `research-agent` — **server wallet**, receives USDC payments
- `client-researcher` — **client wallet**, used by CLI and dashboard proxy to pay for queries

---

## License

MIT
