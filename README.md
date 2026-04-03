# OWS Deep Research Service

**Paid on-chain wallet research via x402 micropayments.**

Built for OWS Hackathon — April 3, 2026 | Track 3: Pay-Per-Call Services

## What It Does

Send a wallet address → get a comprehensive on-chain research report. Portfolio analysis, risk assessment, smart money detection, pattern recognition.

Two interfaces:
- **REST API** — `POST /research` with x402 payment ($0.05 USDC on Base Sepolia)
- **XMTP DM** — send `/research 0x...` to the agent's address

## Partner Integrations

| Partner | Usage |
|---------|-------|
| **OWS** | Wallet identity for the service |
| **x402** | Micropayment gate ($0.05/query) |
| **XMTP** | Encrypted DM interface for humans |
| **Zerion** | Portfolio + DeFi position data |
| **OpenRouter** | LLM synthesis and analysis |

## Quick Start

```bash
# Install
npm install

# Configure (edit .env with your keys)
cp .env.example .env

# Run
npm run dev
```

## API

### POST /research (x402 — $0.05 USDC)

```bash
curl -X POST http://localhost:4000/research \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

Returns JSON with `data` (raw Zerion data) and `analysis` (LLM report with markdown summary).

### GET /health

```bash
curl http://localhost:4000/health
```

### XMTP

Send a DM to the agent's XMTP address:
```
/research 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

## Architecture

```
Client ──(x402 $0.05)──→ POST /research
                              │
                         Zerion API (portfolio + positions)
                              │
                         OpenRouter LLM (deep analysis)
                              │
                         ← JSON Report

XMTP DM ──→ same pipeline ──→ markdown reply
```

## Environment Variables

```env
WALLET_KEY=0x...              # OWS wallet private key
DB_ENCRYPTION_KEY=0x...       # XMTP database encryption
XMTP_ENV=dev                  # XMTP network
ZERION_API_KEY=...            # Zerion portfolio API
OPENROUTER_API_KEY=...        # OpenRouter LLM
FACILITATOR_URL=https://x402.org/facilitator
CHAIN_NETWORK=eip155:84532    # Base Sepolia
PORT=4000
```

## Tech Stack

TypeScript, Node.js 22, Express, @xmtp/agent-sdk, @x402/express, viem, Zerion API, OpenRouter API
