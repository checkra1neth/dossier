# Paid Deep Research Service — Design Spec

## Context

OWS Hackathon, April 3, 2026. Track 3: Pay-Per-Call Services & API Monetization.

Rebuilding `ows-intelligence-wire` from multi-agent system into a single paid on-chain research service. Delete all agent/dashboard code, keep .env and useful Zerion client.

## What It Does

A service that takes a wallet address, fetches on-chain data via Zerion, synthesizes a deep analysis via OpenRouter LLM, and returns a structured report. Charges $0.05 per query via x402 micropayments.

Two interfaces:
- **REST API** — `POST /research` with x402 payment. Returns full JSON report. For agents.
- **XMTP DM** — send "research 0xd8dA..." in a DM. Returns markdown summary. For humans.

## Architecture

```
Client ──(x402 $0.05)──→ POST /research {address}
                              │
                         pipeline.ts
                              │
                    ┌─────────┴──────────┐
                    │                    │
               zerion.ts            llm.ts
          (portfolio + positions)  (OpenRouter synthesis)
                    │                    │
                    └─────────┬──────────┘
                              │
                         report.ts
                     (JSON + markdown)
                              │
                         ← Response

XMTP Agent ──(DM)──→ same pipeline ──→ markdown reply
```

Single process. One OWS wallet (receives x402 payments + XMTP identity). One pipeline, two output formats.

## Tech Stack

- TypeScript, Node.js 22+, Express
- `@xmtp/agent-sdk` v2.3.0 — DM interface
- `@x402/express` + `@x402/core` + `@x402/evm` — payment middleware
- `@open-wallet-standard/core` — OWS wallet identity
- `viem` — Ethereum utilities
- OpenRouter API — LLM synthesis (free tier: `qwen3.6-plus:free`)

## API

### POST /research (x402 gated — $0.05 USDC on Base Sepolia)

**Request:**
```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
}
```

**Response:**
```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "timestamp": 1743638400000,
  "data": {
    "totalValueUsd": 2400000,
    "chains": ["ethereum", "base", "arbitrum"],
    "topPositions": [
      { "asset": "ETH", "valueUsd": 1200000, "percentage": 50 },
      { "asset": "USDC", "valueUsd": 800000, "percentage": 33.3 },
      { "asset": "AAVE", "valueUsd": 400000, "percentage": 16.7 }
    ],
    "isSmartMoney": true,
    "positionCount": 12
  },
  "analysis": {
    "summary": "## Wallet Analysis: 0xd8dA...6045\n\n**Smart Money** wallet...",
    "riskLevel": "low",
    "patterns": ["Long-term holder", "DeFi power user", "Multi-chain active"],
    "verdict": "Established smart money wallet with diversified DeFi exposure"
  }
}
```

### GET /health

Returns service status, uptime, XMTP connection state.

### XMTP DM Interface

User sends: `research 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

Agent replies with `analysis.summary` as markdown message.

Any other message → help text explaining usage.

## Research Pipeline

### Step 1: Zerion Fetch (zerion.ts)

Reuse `getWalletProfile()` from git commit `cbf5930` (packages/enricher/src/zerion.ts). Adapt:
- Remove `@wire/shared/config` import, inline env loading
- Add `chains` field from portfolio response
- Increase positions limit from 5 to 10
- Keep: LRU cache (5min), exponential backoff retry on 429, AbortSignal timeout

### Step 2: LLM Synthesis (llm.ts)

Call OpenRouter with a detailed prompt that produces structured analysis:
- Input: raw Zerion data (portfolio, positions)
- Prompt: instructs LLM to analyze wallet behavior, assess risk, identify patterns, determine smart money status, write a comprehensive markdown summary
- Output: parsed JSON with summary, riskLevel, patterns, verdict
- Model: `qwen3.6-plus:free` via OpenRouter
- Retry: 3x with exponential backoff on 429
- Fallback: if LLM fails, return basic analysis derived from raw data (no LLM dependency for basic functionality)

### Step 3: Report Formatting (report.ts)

Combines Zerion data + LLM analysis into `ResearchReport` type. Generates markdown summary from structured data as fallback if LLM produced no summary.

## Types (types.ts)

```typescript
interface ZerionData {
  totalValueUsd: number;
  chains: string[];
  topPositions: { asset: string; valueUsd: number; percentage: number }[];
  isSmartMoney: boolean;
  positionCount: number;
}

interface Analysis {
  summary: string;
  riskLevel: "low" | "medium" | "high";
  patterns: string[];
  verdict: string;
}

interface ResearchReport {
  address: string;
  timestamp: number;
  data: ZerionData;
  analysis: Analysis;
}
```

## Project Structure

```
ows-intelligence-wire/
├── src/
│   ├── index.ts          # Express server + XMTP agent startup
│   ├── pipeline.ts       # research(address): Promise<ResearchReport>
│   ├── zerion.ts         # Zerion API client (adapted from git)
│   ├── llm.ts            # OpenRouter LLM synthesis
│   ├── report.ts         # JSON + markdown formatting
│   ├── xmtp.ts           # XMTP agent DM listener
│   └── types.ts          # ResearchReport, ZerionData, Analysis
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## Files to Delete

Everything except `.env`, root config files:
- `packages/` — entire directory
- `start.sh`, `bootstrap-group.ts`, `setup-wallets.ts`

## Environment Variables

```env
# Wallet (reuse existing SCANNER_WALLET_KEY or generate new)
WALLET_KEY=0x...

# APIs
ZERION_API_KEY=zk_dev_...
OPENROUTER_API_KEY=...

# XMTP
XMTP_ENV=dev

# x402
FACILITATOR_URL=https://x402.org/facilitator
CHAIN_NETWORK=eip155:84532

# Server
PORT=4000
```

## Deployment

1. **Local MVP:** `npx tsx src/index.ts`
2. **Production:** Railway, single process

## Verification

1. Start: `npx tsx src/index.ts` — prints Express port + XMTP address
2. Health: `curl http://localhost:4000/health` — returns OK
3. Research (no x402 for testing): temporarily disable middleware, `curl -X POST http://localhost:4000/research -H 'Content-Type: application/json' -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'` — returns full report
4. Research (with x402): use `@x402/fetch` from another OWS wallet to pay and query
5. XMTP: send DM to agent's address from Converse app or another XMTP client — get markdown response
