# XMTP Personal On-Chain Intelligence Agent

## Context

Intelligence Wire — hackathon проект з 5 агентами, що спілкувались через HTTP message bus (XMTP native bindings зламались). Код агентів видалений з FS, але збережений в git (`cbf5930`). Shared infrastructure та dashboard залишились.

Мета: переробити multi-agent систему в одного XMTP агента — personal on-chain assistant з portfolio tracking, prediction markets, whale alerts і trading з підтвердженням.

## Architecture

Single-process XMTP agent на базі `@xmtp/agent-sdk` v2.3.0. Один гаманець, один entry point.

```
┌──────────────────────────────────────────────┐
│           XMTP Agent (single process)         │
│                                               │
│  CommandRouter                                │
│  ├── /portfolio <addr>                        │
│  ├── /markets <keyword>                       │
│  ├── /trade <number> <amount>                 │
│  ├── /alerts add|remove|list                  │
│  ├── /subscribe                               │
│  ├── /status                                  │
│  └── /help                                    │
│                                               │
│  AccessControl (whitelist + subscription)      │
│  ConfirmationFlow (ActionWizard)              │
│                                               │
│  Modules:                                     │
│  ├── portfolio.ts  ← Zerion API (x402)        │
│  ├── markets.ts    ← Myriad API               │
│  ├── trading.ts    ← Myriad execute           │
│  └── alerts.ts     ← Allium WS polling        │
│                                               │
│  In-memory state (Set/Map, no database)        │
└──────────────────────────────────────────────┘
```

## Access Model

Semi-public: agent accepts DMs from anyone but gates commands behind access control.

- `ADMIN_WALLET_ADDRESS` env var — admin (full access, approves subscriptions)
- Whitelist `Set<string>` — approved wallet addresses, starts with admin only
- Unknown wallets get `/subscribe` prompt → admin gets DM notification → APPROVE/DENY
- No database: subscribers re-subscribe after restart

## Commands

### /portfolio \<address\>

Fetches wallet data via Zerion API:
- Total portfolio value (USD)
- Top 5 token positions with % allocation
- Smart money flag (>$5M threshold)
- Active DeFi positions count

Source: `packages/enricher/src/zerion.ts` from git `cbf5930`. Has LRU cache (5min), exponential backoff on 429.

### /markets \<keyword\>

Searches Myriad prediction markets:
- Keyword matching on market titles
- Relevance scoring (asset mention +10, crypto +3, volume +2, liquidity +1)
- Returns top 3-5 results with odds and volume
- Numbered list for easy `/trade` reference

Source: `packages/trader/src/myriad.ts` from git `cbf5930`.

### /trade \<market_number\> \<amount\>

Two-step confirmation flow using XMTP ActionWizard:
1. Agent shows trade details (market, side, odds, amount)
2. User replies YES/NO
3. On YES: execute via Myriad API, return position details
4. Pending confirmations expire after 60 seconds

Confirmation state: `Map<conversationId, PendingTrade>` in memory.

### /alerts add|remove|list

Alert types:
- `whale >$1M` — transfers above threshold
- `address 0x...` — activity from specific address

Implementation: periodic Allium polling (configurable interval, default 30s). When alert matches, agent sends proactive XMTP DM to the user who created it.

Active alerts: `Map<userId, Alert[]>` in memory.

### /subscribe

For non-whitelisted users:
1. User sends `/subscribe`
2. Agent sends DM to admin with requester address
3. Admin replies APPROVE/DENY
4. Agent notifies requester of result and adds to whitelist Set

### /status

Returns agent health: uptime, connected subscribers count, active alerts count, XMTP connection status.

### /help

Lists all available commands with brief descriptions.

## Project Structure

```
ows-intelligence-wire/
├── packages/shared/          # existing — config, types, SSE
├── packages/dashboard/       # existing — React UI (future use)
├── src/                      # NEW — single agent
│   ├── agent.ts              # Entry: XMTP init, CommandRouter, event handlers
│   ├── access.ts             # Whitelist Set, subscription flow, admin DM
│   ├── modules/
│   │   ├── portfolio.ts      # Zerion API client (from git cbf5930)
│   │   ├── markets.ts        # Myriad search + scoring (from git cbf5930)
│   │   ├── trading.ts        # Confirmation flow + Myriad execute
│   │   └── alerts.ts         # Allium polling + alert matching + proactive DM
│   └── types.ts              # Simplified types for single agent
├── package.json              # Updated deps
├── tsconfig.json             # TypeScript config
└── .env                      # Existing + ADMIN_WALLET_ADDRESS
```

## Code Reuse from Git

| Source (git `cbf5930`) | Destination | Changes |
|---|---|---|
| `packages/enricher/src/zerion.ts` | `src/modules/portfolio.ts` | Remove Express deps, return formatted string |
| `packages/trader/src/myriad.ts` | `src/modules/markets.ts` | Split search/execute, add numbered output |
| `packages/shared/src/types.ts` | `src/types.ts` | Keep WireMessage, Signal, TradeResult; drop agent-specific types |
| `packages/shared/src/config.ts` | `src/agent.ts` | Inline env loading, remove port mappings |

## Dependencies

New:
- `@xmtp/agent-sdk` — XMTP messaging, CommandRouter, ActionWizard

Existing (already in project):
- `viem` — wallet/signing
- `dotenv` — env vars

No database. No additional frameworks.

## Environment Variables

```env
# Existing
SCANNER_WALLET_KEY=0x...        # Reuse one as agent wallet
ZERION_API_KEY=...
ALLIUM_API_KEY=...
XMTP_ENV=dev

# New
ADMIN_WALLET_ADDRESS=0x...      # Admin wallet for access control
ALLIUM_POLL_INTERVAL=30000      # Alert polling interval ms
```

## Deployment Path

1. **MVP (local):** `npx tsx src/agent.ts` on mac
2. **Production:** Railway with `XMTP_ENV=production`, persistent process

## Verification

1. Start agent locally: `npx tsx src/agent.ts` — prints XMTP address
2. Send DM from admin wallet via XMTP client (Converse app or another agent)
3. Test `/help` → returns command list
4. Test `/portfolio 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (vitalik.eth) → Zerion data
5. Test `/markets bitcoin` → Myriad results
6. Test `/trade 1 5` → confirmation flow → YES → execution
7. Test `/alerts add whale >$1M` → wait for match → proactive DM
8. Test access: send from unknown wallet → gets `/subscribe` prompt
