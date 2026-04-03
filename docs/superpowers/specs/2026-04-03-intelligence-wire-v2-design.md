# OWS Intelligence Wire v2 — Design Spec

## Overview

Evolve the current single-command research agent into a full DeFi AI Agent with analytics, monitoring, and wallet actions — all paid via x402, orchestrated through XMTP, powered by Zerion API + OWS wallets.

**Current state:** `/research` command only — portfolio + LLM verdict for $0.05.

**Target state:** 14 commands across 3 categories: Analytics, Monitoring, Wallet Actions.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    XMTP Client                       │
│  OWS wallet (client-researcher)                      │
│  Commands: /research, /swap, /watch, etc.            │
└──────────────┬──────────────────────────┬────────────┘
               │ XMTP DM                  │ HTTP + x402
               ▼                          ▼
┌──────────────────────────┐  ┌─────────────────────────┐
│    XMTP Agent (server)   │  │   Express + x402 MW     │
│  CommandRouter           │  │   POST /research  $0.05  │
│  /research, /quick, etc. │  │   POST /swap      $0.01  │
│  wallet-send-calls       │  │   POST /pnl       $0.02  │
│  transaction-reference   │  │   ...                    │
└──────────┬───────────────┘  └──────────┬──────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────────────────────────────────────┐
│                   Command Handler                     │
│                                                       │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐ │
│  │Analytics│ │Monitor  │ │ Wallet   │ │  Shared   │ │
│  │ Module  │ │ Module  │ │ Actions  │ │  Services │ │
│  └────┬────┘ └────┬────┘ └────┬─────┘ └─────┬─────┘ │
│       │           │           │              │       │
│       ▼           ▼           ▼              ▼       │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Zerion  │ │ Zerion  │ │  Zerion  │ │ OpenRouter│ │
│  │ Wallet  │ │Webhooks │ │  Swap    │ │   LLM    │ │
│  │  API    │ │  API    │ │   API    │ │          │ │
│  └─────────┘ └─────────┘ └────┬─────┘ └──────────┘ │
│                                │                     │
│                                ▼                     │
│                          ┌──────────┐                │
│                          │ OWS sign │                │
│                          │ send-tx  │                │
│                          └──────────┘                │
└──────────────────────────────────────────────────────┘
```

---

## Commands

### 1. Analytics

#### `/quick <address>` — $0.01
Quick portfolio snapshot without LLM analysis.

**Zerion endpoints:**
- `GET /v1/wallets/{address}/portfolio` — total value, chain distribution, 24h change

**Response (XMTP text):**
```
📊 Quick: 0x8Ce0...7509
💰 $695.88 (▲ +2.1% 24h)
🔗 Chains: base, ethereum, polygon (+31 more)
🏦 Top: USDC $320, LVWETH $122, ALIVE $82
```

No LLM. Fast (~1s).

---

#### `/research <address>` — $0.05 (v2, enhanced)
Deep research with DeFi positions, PnL, transaction patterns, and LLM verdict.

**Zerion endpoints:**
- `GET /v1/wallets/{address}/portfolio` — total value, chains
- `GET /v1/wallets/{address}/positions/?sort=-value&filter[positions]=only_simple` — spot holdings
- `GET /v1/wallets/{address}/positions/?filter[positions]=only_complex` — DeFi positions (staking, LP, lending)
- `GET /v1/wallets/{address}/pnl` — realized/unrealized PnL, ROI
- `GET /v1/wallets/{address}/transactions/?page[size]=20` — recent activity for behavior analysis

**LLM prompt enriched with:**
- DeFi exposure breakdown (% in staking, LP, lending)
- PnL data (profitable or underwater)
- Transaction frequency and patterns
- Activity recency

**Response:** same format as current but with DeFi and PnL sections added.

---

#### `/pnl <address>` — $0.02
Profit & loss analysis.

**Zerion endpoint:**
- `GET /v1/wallets/{address}/pnl`

**Response:**
```
📈 PnL: 0x8Ce0...7509
💵 Net invested: $45,200
📊 Realized gain: +$12,400
📊 Unrealized gain: -$1,800
💰 Total fees paid: $890
🎯 ROI: +23.4%
```

---

#### `/defi <address>` — $0.02
DeFi protocol positions breakdown.

**Zerion endpoint:**
- `GET /v1/wallets/{address}/positions/?filter[positions]=only_complex&sort=-value`

**Response:**
```
🏦 DeFi Positions: 0x8Ce0...7509
━━━━━━━━━━━━━━━━━━━━━━━━━━
Aave v3 (lending):
  ├ Deposited: 1,200 USDC ($1,200)
  └ Borrowed: 0.5 ETH ($1,015)

Lido (staking):
  └ Staked: 2.5 ETH ($5,075)

Uniswap v3 (LP):
  └ ETH/USDC: $3,200
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total DeFi: $9,475 (58% of portfolio)
```

---

#### `/history <address>` — $0.02
Transaction history with behavioral analysis.

**Zerion endpoint:**
- `GET /v1/wallets/{address}/transactions/?page[size]=20&currency=usd`

**Response:**
```
📜 History: 0x8Ce0...7509 (last 20 txns)
━━━━━━━━━━━━━━━━━━━━━━━━━━
3h ago  — trade: 500 USDC → 0.24 ETH (base)
1d ago  — receive: 1,000 USDC from 0xab12... (base)
2d ago  — execute: Aave deposit 500 USDC (ethereum)
5d ago  — trade: 1 ETH → 2,030 USDC (ethereum)

📊 Pattern: 8 trades, 5 receives, 4 executes, 3 sends
⏱️ Frequency: ~2 txns/day
🏷️ Profile: Active DeFi user, regular trader
```

---

#### `/nft <address>` — $0.02
NFT portfolio overview.

**Zerion endpoints:**
- `GET /v1/wallets/{address}/nft-collections`
- `GET /v1/wallets/{address}/nft-positions/?page[size]=10`

**Response:**
```
🖼️ NFTs: 0x8Ce0...7509
━━━━━━━━━━━━━━━━━━━━━━━━━━
Collections: 12
Top by floor:
  Bored Ape YC: 1 NFT (floor: 28 ETH)
  Pudgy Penguins: 2 NFTs (floor: 12 ETH)
  Azuki: 1 NFT (floor: 8 ETH)

Total estimated floor: ~50 ETH ($101,500)
```

---

#### `/compare <addr1> <addr2>` — $0.05
Side-by-side wallet comparison with LLM analysis.

**Zerion endpoints (x2 wallets):**
- Portfolio + positions + PnL for each

**LLM:** compare strategies, risk profiles, performance.

**Response:**
```
⚔️ Compare: 0x8Ce0 vs 0x7bfe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
               Wallet A      Wallet B
Total Value    $695          $11.4M
Chains         34            31
Smart Money    NO            YES
Risk           MEDIUM        HIGH
ROI            +23%          +180%
DeFi %         58%           72%

🏁 Verdict: Wallet B is a sophisticated yield optimizer...
```

---

### 2. Monitoring

#### `/watch <address>` — $0.10 (one-time setup)
Subscribe to wallet activity alerts via Zerion webhooks.

**Zerion endpoint:**
- `POST /v1/transactions/subscribe` — create webhook subscription

**Server needs:** a public webhook URL (or tunnel for dev). When Zerion sends a webhook:
1. Parse transaction (type, transfers, amounts)
2. Send XMTP message to the user who set up the watch

**Response:**
```
👁️ Watching 0x8Ce0...7509
You'll receive alerts when this wallet:
  • Sends or receives tokens
  • Swaps on DEXes
  • Interacts with DeFi protocols

Use /unwatch 0x8Ce0... to stop.
```

**Webhook alert format (XMTP):**
```
🔔 Alert: 0x8Ce0...7509
trade: 10,000 USDC → 4.9 ETH on Uniswap (base)
⏱️ 2 minutes ago
```

---

#### `/unwatch <address>` — free
Remove webhook subscription.

**Zerion endpoint:**
- `DELETE /v1/transactions/subscriptions/{id}`

---

#### `/subscribe` — $0.50/week
Daily digest of all watched wallets.

**Implementation:** Cron job that at 09:00 UTC:
1. Fetches recent transactions for all watched wallets
2. Generates summary via LLM
3. Sends via XMTP

---

### 3. Wallet Actions

#### `/balance` — free
Show OWS wallet balances.

**Zerion endpoint:**
- `GET /v1/wallets/{ows_address}/positions/?sort=-value&filter[positions]=only_simple`

**Response:**
```
💰 Your wallet: 0x1582...781f
━━━━━━━━━━━━━━━━━━━━━━━━━━
USDC: $0.05 (Base)
ETH: $0.00

Total: $0.05
```

---

#### `/send <amount> <token> to <address>` — $0.01
Send tokens from OWS wallet.

**Flow:**
1. Parse: amount, token symbol, destination address
2. Resolve token address via `GET /v1/fungibles/?filter[search_query]=<symbol>`
3. Build ERC-20 transfer calldata (or native transfer)
4. `ows sign send-tx --chain <chain> --wallet <wallet> --tx <hex>`

**Confirmation step (XMTP):**
```
📤 Confirm send:
  10 USDC → 0xab12...cd34 on Base
  Estimated gas: ~$0.01

Type "confirm" to execute or "cancel".
```

---

#### `/swap <amount> <tokenIn> to <tokenOut> [on <chain>]` — $0.01
Swap tokens via Zerion DEX aggregator.

**Flow:**
1. Parse: amount, input token, output token, chain (default: base)
2. Resolve token addresses via Zerion fungibles API
3. `GET /v1/swap/offers/?input[from]=<ows_addr>&input[chain_id]=<chain>&input[asset_address]=<tokenIn>&input[amount]=<amount_wei>&output[chain_id]=<chain>&output[asset_address]=<tokenOut>&slippage_percent=2`
4. Show best offer to user for confirmation
5. If token needs approval: sign approval tx first
6. `ows sign send-tx --chain <chain> --wallet <wallet> --tx <calldata>`

**Confirmation:**
```
🔄 Swap offer (via 1inch):
  0.05 USDC → ~0.000024 ETH
  Slippage: 2% max
  Gas: ~$0.02

Type "confirm" or "cancel".
```

---

#### `/bridge <amount> <token> from <chainA> to <chainB>` — $0.01
Bridge tokens cross-chain via Zerion bridge aggregator.

**Flow:** Same as swap but with different `input[chain_id]` and `output[chain_id]`.

**Pre-check:**
- `GET /v1/swap/fungibles/?input[chain_id]=<from>&output[chain_id]=<to>&direction=both` — verify token is bridgeable

**Confirmation:**
```
🌉 Bridge offer (via Relay):
  100 USDC: Base → Ethereum
  Output: ~99.5 USDC
  Time: ~2 min
  Gas: ~$0.15

Type "confirm" or "cancel".
```

---

## Pricing (x402)

| Command | Price | Rationale |
|---------|-------|-----------|
| `/quick` | $0.01 | 1 Zerion call, no LLM |
| `/research` | $0.05 | 5 Zerion calls + LLM |
| `/pnl` | $0.02 | 1 Zerion call |
| `/defi` | $0.02 | 1 Zerion call |
| `/history` | $0.02 | 1 Zerion call |
| `/nft` | $0.02 | 2 Zerion calls |
| `/compare` | $0.05 | 10 Zerion calls + LLM |
| `/watch` | $0.10 | Webhook setup + ongoing delivery |
| `/unwatch` | free | Cleanup |
| `/subscribe` | $0.50/week | Daily LLM digest |
| `/balance` | free | Read own wallet |
| `/send` | $0.01 | Tx signing |
| `/swap` | $0.01 | Zerion quote + tx signing |
| `/bridge` | $0.01 | Zerion quote + tx signing |

---

## Server Routes (x402)

```
POST /quick          $0.01
POST /research       $0.05
POST /pnl            $0.02
POST /defi           $0.02
POST /history        $0.02
POST /nft            $0.02
POST /compare        $0.05
POST /watch          $0.10
POST /swap           $0.01
POST /bridge         $0.01
POST /send           $0.01
GET  /health         free
POST /webhook        free (Zerion callback)
```

---

## Data Flow: Swap Example

```
User: /swap 10 USDC to ETH on base
  │
  ▼
XMTP Agent: parse command
  │
  ▼
Zerion: GET /v1/fungibles/?filter[search_query]=USDC → resolve address
Zerion: GET /v1/swap/offers/?input[from]=0x1582...&input[chain_id]=base
        &input[asset_address]=0x8335...&input[amount]=10000000
        &output[chain_id]=base&output[asset_address]=0xeeee...
        &slippage_percent=2
  │
  ▼ 5 offers returned
Select best (sorted by output amount)
  │
  ▼
XMTP: Send confirmation message with offer details
User: "confirm"
  │
  ▼
Check: offer.preconditions_met.enough_allowance?
  NO → OWS: sign approval tx → broadcast
  YES ↓
  │
  ▼
OWS: ows sign send-tx --chain base --wallet client-researcher
     --tx <offer.transaction.data>
  │
  ▼
XMTP: "✅ Swapped 10 USDC → 0.0049 ETH on Base. TX: 0xabc..."
```

---

## File Structure

```
src/
├── index.ts              # Express server + x402 routes
├── xmtp.ts               # XMTP agent + CommandRouter
├── client.ts             # Interactive client
├── commands/
│   ├── quick.ts          # /quick handler
│   ├── research.ts       # /research v2 (enhanced pipeline)
│   ├── pnl.ts            # /pnl handler
│   ├── defi.ts           # /defi handler
│   ├── history.ts        # /history handler
│   ├── nft.ts            # /nft handler
│   ├── compare.ts        # /compare handler
│   ├── watch.ts          # /watch + /unwatch
│   ├── subscribe.ts      # /subscribe (daily digest)
│   ├── balance.ts        # /balance handler
│   ├── send.ts           # /send handler
│   ├── swap.ts           # /swap handler
│   └── bridge.ts         # /bridge handler
├── services/
│   ├── zerion.ts         # Zerion API client (all endpoints)
│   ├── ows.ts            # OWS wallet operations (sign, send)
│   ├── llm.ts            # OpenRouter LLM analysis
│   └── webhooks.ts       # Webhook receiver + alert dispatcher
├── types.ts              # Shared types
├── report.ts             # Report formatting (markdown)
└── pipeline.ts           # Legacy (refactored into commands/)
```

---

## Zerion API Endpoints Used

| Endpoint | Commands |
|----------|----------|
| `GET /v1/wallets/{addr}/portfolio` | quick, research, compare |
| `GET /v1/wallets/{addr}/positions/?filter[positions]=only_simple` | quick, research, balance, compare |
| `GET /v1/wallets/{addr}/positions/?filter[positions]=only_complex` | research, defi, compare |
| `GET /v1/wallets/{addr}/pnl` | research, pnl, compare |
| `GET /v1/wallets/{addr}/transactions/` | research, history |
| `GET /v1/wallets/{addr}/nft-collections` | nft |
| `GET /v1/wallets/{addr}/nft-positions/` | nft |
| `GET /v1/wallets/{addr}/charts/{period}` | research (growth trend) |
| `GET /v1/swap/offers/` | swap, bridge |
| `GET /v1/swap/fungibles/` | bridge (verify route) |
| `GET /v1/fungibles/?filter[search_query]=` | swap, bridge, send (resolve token) |
| `GET /v1/gas/` | swap, bridge, send (fee estimate) |
| `POST /v1/transactions/subscribe` | watch |
| `DELETE /v1/transactions/subscriptions/{id}` | unwatch |

---

## OWS Operations

| Operation | Commands |
|-----------|----------|
| `ows sign send-tx --chain <chain>` | swap, bridge, send |
| `ows sign tx --chain <chain>` | approval transactions |
| `ows pay request` | x402 payment (client side) |
| Wallet balance check (via Zerion) | balance |

---

## Implementation Phases

### Phase 1: Enhanced Analytics (4-6h)
- Refactor `zerion.ts` → `services/zerion.ts` with all endpoints
- `/quick`, `/research` v2, `/pnl`, `/defi`, `/history`, `/nft`
- Update x402 routes for new endpoints
- Update XMTP CommandRouter

### Phase 2: Wallet Actions (4-6h)
- `services/ows.ts` — wrapper for sign/send operations
- `/balance`, `/send`, `/swap`, `/bridge`
- Confirmation flow (XMTP message → user confirms → execute)
- Token address resolution via Zerion fungibles API

### Phase 3: Monitoring (3-4h)
- `/watch`, `/unwatch` — Zerion webhook subscriptions
- Webhook receiver endpoint
- Alert formatting and XMTP delivery
- `/subscribe` — daily digest cron

### Phase 4: Compare + Polish (2-3h)
- `/compare` — dual wallet analysis
- Error handling for all commands
- Rate limiting
- Help text updates

---

## Confirmation Flow (Wallet Actions)

All wallet actions that move funds require explicit confirmation:

```
User: /swap 10 USDC to ETH
Agent: [shows offer details, asks "confirm" or "cancel"]
User: confirm
Agent: [executes, shows tx hash]
```

State management: `pendingAction` map per conversation ID, cleared on confirm/cancel/timeout (5 min).

---

## Error Handling

- Zerion API errors → user-friendly message + suggestion
- Insufficient balance → show balance, suggest /balance
- Swap no offers → suggest different pair or amount
- OWS sign failure → show error, don't retry
- Webhook delivery failure → retry 3x with backoff
- x402 payment failure → existing error handling (contract revert detection)
