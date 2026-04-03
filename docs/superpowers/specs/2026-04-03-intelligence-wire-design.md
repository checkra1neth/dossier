# Intelligence Wire — Design Spec

## Overview

A multi-agent system where 5 autonomous AI agents collect on-chain intelligence, analyze it, and sell actionable signals. Agents communicate exclusively via XMTP encrypted messaging. External clients pay for signals via x402 micropayments.

**Hackathon:** OWS Hackathon, April 3 2026
**Tracks:** 3 (Pay-Per-Call) + 4 (Multi-Agent Systems)
**Chain:** Base Sepolia (testnet), architecture supports mainnet switch via env var
**Stack:** TypeScript, Node.js 22+, React + Vite

## Architecture

5 separate Node.js processes, each with its own OWS wallet and XMTP identity. Communication via a shared XMTP group chat. Each agent listens to all messages but reacts only to its relevant `type`.

```
Allium WS -> Scanner -> XMTP group {"type":"raw_event"}
                          |
               Enricher reads raw_event -> Zerion -> {"type":"enriched_event"}
                          |
               Analyst reads enriched_event -> LLM -> {"type":"signal"}
                          |                             |
               Distributor reads signal          Trader reads signal
               -> XMTP DM to subscribers         -> Myriad/DFlow/MoonPay/Ripple
               -> {"type":"status"}               -> {"type":"trade_result"}
```

## Agent Specifications

### Agent 1: Scanner (port 4001)
- **Input:** Allium WebSocket streaming (`ethereum.transactions`, `base.dex_trades`)
- **Logic:** Filter whale txs (>$100K), large DEX trades, unusual gas spikes
- **Additional:** Uniblock Unified API for cross-chain address verification
- **Output:** `raw_event` to XMTP group
- **SSE:** `GET /events` for dashboard

### Agent 2: Enricher (port 4002)
- **Input:** XMTP group `raw_event` messages
- **Logic:** Zerion API — `getWalletPortfolio()`, `listWalletPositions()`, `listWalletTransactions()` to profile the whale
- **Output:** `enriched_event` to XMTP group (address + portfolio + pattern)
- **SSE:** `GET /events` for dashboard

### Agent 3: Analyst (port 4003)
- **Input:** XMTP group `enriched_event` messages
- **Logic:** OpenRouter LLM analyzes enriched data, generates actionable signal (BUY/SELL/WATCH + confidence + reasoning)
- **Output:** `signal` to XMTP group
- **x402 endpoints:**
  - `GET /api/signals` — $0.01/request (latest signals)
  - `GET /api/signals/latest` — $0.005 (single latest)
  - `GET /api/history` — $0.05 (24h history)
- **SSE:** `GET /events` for dashboard

### Agent 4: Distributor (port 4004)
- **Input:** XMTP group `signal` messages + XMTP DMs from subscribers
- **Logic:** Manage subscriber list, send personalized encrypted alerts via XMTP DM
- **Commands:** `/subscribe`, `/unsubscribe`, `/status`
- **Output:** XMTP DM to each subscriber + `status` to group
- **SSE:** `GET /events` for dashboard

### Agent 5: Trader (port 4005)
- **Input:** XMTP group `signal` messages
- **Logic:** On BUY/SELL signal — trade on Myriad prediction markets, DFlow for execution, MoonPay for bridges, Ripple for cross-border demo
- **Output:** `trade_result` to XMTP group
- **SSE:** `GET /events` for dashboard

## XMTP Message Protocol

```typescript
interface WireMessage {
  type: "raw_event" | "enriched_event" | "signal" | "trade_result" | "status";
  from: "scanner" | "enricher" | "analyst" | "trader" | "distributor";
  timestamp: number;
  data: RawEvent | EnrichedEvent | Signal | TradeResult | StatusUpdate;
}

interface RawEvent {
  chain: string;
  txHash: string;
  from: string;
  to: string;
  valueUsd: number;
  type: "whale_transfer" | "large_dex_trade" | "gas_spike";
}

interface EnrichedEvent extends RawEvent {
  walletProfile: {
    totalValueUsd: number;
    topPositions: { asset: string; valueUsd: number }[];
    txCount30d: number;
    isSmartMoney: boolean;
  };
}

interface Signal {
  id: string;
  action: "BUY" | "SELL" | "WATCH";
  asset: string;
  confidence: number; // 0-100
  reasoning: string;
  basedOn: string; // enriched_event reference
}

interface TradeResult {
  signalId: string;
  platform: "myriad" | "dflow" | "moonpay" | "ripple";
  action: string;
  amount: number;
  status: "success" | "failed";
  txHash?: string;
}

interface StatusUpdate {
  message: string;
  subscriberCount?: number;
}
```

## React Dashboard (port 3000)

4-panel layout:

1. **Agent Network** (top-left) — 5 nodes with animated connections, wallet balances, pulse on message
2. **Live XMTP Feed** (top-right) — scrollable color-coded message log
3. **Signals** (bottom-left) — table of BUY/SELL/WATCH signals with confidence
4. **Trading Activity** (bottom-right) — Trader results and P&L

Data via SSE from each agent's `GET /events` endpoint on ports 4001-4005.

## Project Structure

```
ows-intelligence-wire/
├── packages/
│   ├── shared/              # Types, XMTP helpers, SSE, config
│   ├── scanner/             # Agent 1: Allium + Uniblock
│   ├── enricher/            # Agent 2: Zerion
│   ├── analyst/             # Agent 3: LLM + x402
│   ├── distributor/         # Agent 4: XMTP DM
│   ├── trader/              # Agent 5: Myriad + DFlow + MoonPay + Ripple
│   └── dashboard/           # React + Vite
├── .env                     # Wallet keys, API keys
├── package.json             # Workspace root
└── start.sh                 # Launch all agents + dashboard
```

## Partner Integration Map

| Partner | Agent | Integration |
|---------|-------|------------|
| Allium | Scanner | WebSocket streaming + Explorer API |
| Uniblock | Scanner | Unified JSON-RPC cross-chain |
| Zerion | Enricher | Portfolio + positions + transactions API |
| XMTP | ALL 5 | Group chat (agent-sdk) + DM (Distributor) |
| x402 | Analyst | Express middleware for paid API |
| OWS | ALL 5 | Wallet per agent |
| Myriad | Trader | CLI/SDK prediction market trading |
| DFlow | Trader | Order flow auctions via swap-api-utils |
| MoonPay | Trader | CLI swaps and bridges |
| Ripple | Trader | xrpl.js cross-border payment demo |

**Score: 9/10 partners** (Sui optional if time permits)

## Key Dependencies

```
@xmtp/agent-sdk          — XMTP messaging
@x402/core @x402/evm @x402/express @x402/fetch — x402 payments
@open-wallet-standard/core — OWS wallets
zerion                    — Zerion API
xrpl                      — Ripple/XRPL
@dflow-protocol/swap-api-utils — DFlow
@myriadmarkets/cli        — Myriad
@moonpay/cli              — MoonPay
viem                      — Ethereum utilities
react react-dom           — Dashboard
vite                      — Frontend build
concurrently              — Multi-process launch
```

## Environment Variables

```bash
# XMTP (5 separate wallet keys)
SCANNER_WALLET_KEY=0x...
ENRICHER_WALLET_KEY=0x...
ANALYST_WALLET_KEY=0x...
DISTRIBUTOR_WALLET_KEY=0x...
TRADER_WALLET_KEY=0x...
XMTP_ENV=dev

# APIs
ALLIUM_API_KEY=...
ZERION_API_KEY=zk_dev_...
UNIBLOCK_API_KEY=...
OPENROUTER_API_KEY=...

# x402
EVM_ADDRESS=0x...  # Analyst's address for receiving payments
FACILITATOR_URL=https://x402.org/facilitator

# Chain
CHAIN_NETWORK=eip155:84532  # Base Sepolia
```
