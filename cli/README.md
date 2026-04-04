# dossier-connect

Connect your [OWS](https://ows.dev) wallet to the [Dossier](https://dossier.up.railway.app) dashboard — a DeFi AI agent with 14 commands, x402 USDC micropayments, and XMTP messaging.

## Quick Start

```bash
npx dossier-connect <session-code>
```

1. Open the Dossier dashboard
2. Click **Connect OWS Wallet**
3. Copy the session code
4. Run the command above in your terminal

## How It Works

```
Browser ←—WebSocket—→ Dossier Server ←—WebSocket—→ dossier-connect (your terminal)
                         (relay)                        (OWS wallet)
```

- Your private keys **never leave your machine**
- The server is a relay — it only forwards signing requests
- Payments use **EIP-3009** (gasless TransferWithAuthorization)
- All signing happens locally via the OWS SDK

## Prerequisites

Install the OWS CLI:

```bash
curl -fsSL https://ows.dev/install.sh | sh
```

Create a wallet (if you don't have one):

```bash
ows wallet create my-wallet
```

Fund it with USDC on Base (chain 8453) for x402 payments.

## Options

```
npx dossier-connect <session-code> [options]

Options:
  -w, --wallet <name>   OWS wallet name (default: client-researcher)
  --host <url>          Custom server URL
  -h, --help            Show help
  -v, --version         Show version
```

## Examples

```bash
# Connect with default wallet
npx dossier-connect abc123

# Use a specific wallet
npx dossier-connect abc123 --wallet my-wallet
```

## What You Can Do

Once connected, use the Dossier dashboard to:

| Command | Price | Description |
|---------|-------|-------------|
| `/quick` | $0.01 | Portfolio snapshot |
| `/research` | $0.05 | Deep AI-powered wallet analysis |
| `/pnl` | $0.02 | Profit & loss breakdown |
| `/defi` | $0.02 | DeFi protocol positions |
| `/history` | $0.02 | Transaction history & patterns |
| `/nft` | $0.02 | NFT collections |
| `/compare` | $0.05 | Side-by-side wallet comparison |
| `/swap` | $0.01 | DEX swap via Zerion |
| `/send` | $0.01 | Token transfer |
| `/bridge` | $0.01 | Cross-chain bridge |
| `/watch` | $0.10 | Wallet activity alerts via XMTP |
| `/balance` | free | Your wallet balance |

## License

MIT
