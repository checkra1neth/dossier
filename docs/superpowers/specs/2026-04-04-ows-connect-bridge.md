# OWS Connect — WebSocket Bridge for Browser Wallet Connection

## Problem

OWS is a CLI-based wallet. The Dossier web dashboard cannot access users' local OWS wallets directly. Users need a way to connect their OWS wallet to the browser so they can sign x402 payments and wallet actions from the dashboard.

## Solution

A WebSocket relay bridge between the browser and a local CLI process. The server acts as a relay — it never sees private keys, only forwards signing requests and receives signatures.

```
Browser ←—WebSocket—→ Server (relay) ←—WebSocket—→ CLI (ows-bridge)
         session:abc                    session:abc
```

## Pairing Flow

1. Browser generates a 6-character session code (e.g. `a1b2c3`)
2. Browser opens WebSocket to `/ws?session=a1b2c3&role=browser`
3. Dashboard shows: "Run in terminal: `npx dossier connect a1b2c3`"
4. User runs the command — CLI opens WebSocket to `/ws?session=a1b2c3&role=signer`
5. CLI sends `hello` message with wallet address and name
6. Server relays `paired` event to browser
7. Dashboard shows "Connected: 0x1234...5678"

## Signing Flow

1. User clicks /research on dashboard → `POST /api/research` with header `X-Bridge-Session: a1b2c3`
2. api-proxy finds the bridge session, sends `sign_request` through WebSocket to CLI
3. CLI receives request, signs via OWS SDK (`signTypedData`), returns `sign_response`
4. api-proxy attaches signature to x402 payment header, proxies request to backend
5. Result returns to browser

If no bridge session exists or is disconnected — fallback to server's `client-researcher` wallet (current behavior).

## Protocol Messages (JSON over WebSocket)

### CLI → Server
```json
{"type": "hello", "address": "0x...", "name": "my-wallet"}
{"type": "sign_response", "id": "req_1", "signature": "0x..."}
{"type": "sign_rejected", "id": "req_1", "reason": "user cancelled"}
```

### Server → Browser
```json
{"type": "paired", "address": "0x...", "name": "my-wallet"}
{"type": "disconnected"}
```

### Server → CLI
```json
{"type": "sign_request", "id": "req_1", "method": "signTypedData", "params": {"domain": {...}, "types": {...}, "primaryType": "...", "message": {...}}}
```

## Server: `src/ws-bridge.ts`

Responsibilities:
- WebSocket upgrade handler on path `/ws`
- Session store: `Map<sessionId, { browser: WebSocket | null, signer: WebSocket | null, address: string, name: string, pendingRequests: Map<reqId, resolver> }>`
- Match browser and signer by session ID
- Relay sign requests from api-proxy to signer, return responses as Promises
- Cleanup on disconnect (notify browser, remove session)
- Unpaired sessions expire after 5 minutes

Exports:
- `setupBridge(httpServer)` — attach WebSocket server to existing HTTP server
- `requestSignature(sessionId, method, params): Promise<string>` — called by api-proxy, returns signature or throws on timeout/rejection
- `getSession(sessionId): { address, name, connected } | null` — check if session has a connected signer

## Server: changes to `src/api-proxy.ts`

Replace local OWS signing with bridge-aware logic:

```
For each /api/* request:
1. Check X-Bridge-Session header
2. If header present AND session has connected signer:
   → Build x402 EIP-712 typed data
   → Call requestSignature(sessionId, "signTypedData", typedData)
   → Attach signature to payment header
   → Proxy request to backend
3. If no header or no signer:
   → Fallback to current behavior (server wallet signs)
```

## Server: changes to `src/index.ts`

Minimal — attach bridge to HTTP server:

```typescript
import { setupBridge } from "./ws-bridge.ts";
const server = app.listen(port, () => { ... });
setupBridge(server);
```

## CLI Bridge: `src/bridge.ts`

Entry point: `npm run bridge <session-code>` or `npx dossier connect <session-code>`

1. Parse session code from CLI args
2. Determine OWS wallet: `--wallet <name>` flag or `OWS_CLIENT_WALLET` env or default `client-researcher`
3. Resolve wallet address via OWS SDK
4. Connect WebSocket to `wss://<host>/ws?session=<code>&role=signer`
5. Send `hello` with address and wallet name
6. Listen for `sign_request` messages
7. For each request: log what's being signed, call OWS SDK `signTypedData()`, send `sign_response`
8. Keep connection alive until Ctrl+C
9. On disconnect: clean exit

Terminal output:
```
Connecting to dossier-production-1366.up.railway.app...
Paired! Wallet: my-wallet (0x1234...5678)
Waiting for signing requests...

Sign request: x402 payment $0.05 USDC for /research
  Signed

Sign request: x402 payment $0.01 USDC for /quick
  Signed

^C Disconnected.
```

package.json script:
```json
"bridge": "npx tsx src/bridge.ts"
```

## Frontend: `frontend/src/hooks/useBridge.ts`

React hook that manages the WebSocket connection:

```typescript
function useBridge(): {
  sessionId: string;
  status: "waiting" | "connected" | "disconnected";
  address: string | null;
  name: string | null;
}
```

- Generates 6-char alphanumeric session code on mount
- Opens WebSocket to `/ws?session=<code>&role=browser`
- Listens for `paired` and `disconnected` messages
- Updates state accordingly
- Reconnects on unexpected close (max 3 retries)
- Stores sessionId for use in API requests

## Frontend: changes to `frontend/src/api.ts`

Add session ID to all `/api/*` requests:

```typescript
let bridgeSessionId: string | null = null;

export function setBridgeSession(id: string | null): void {
  bridgeSessionId = id;
}

// In query() function, add header:
if (bridgeSessionId) {
  headers["X-Bridge-Session"] = bridgeSessionId;
}
```

## Frontend: changes to `frontend/src/pages/Dashboard.tsx`

Replace wallet connection UI:

**Not connected state:**
- Show pairing code with copy-to-clipboard
- Show "Run in terminal: npx dossier connect <code>"
- Animated waiting indicator

**Connected state:**
- Green dot + shortened address in topbar
- Click to see wallet details + disconnect option

Remove:
- Wallet name text input
- `connectWallet()` API call
- `getActiveWallet()` on mount

## Files Summary

### New files
| File | Purpose |
|------|---------|
| `src/ws-bridge.ts` | WebSocket server, session store, relay |
| `src/bridge.ts` | CLI bridge client entry point |
| `frontend/src/hooks/useBridge.ts` | React hook for bridge WebSocket |

### Modified files
| File | Changes |
|------|---------|
| `src/index.ts` | Import setupBridge, attach to HTTP server |
| `src/api-proxy.ts` | Add remote signing via bridge, fallback to local |
| `frontend/src/api.ts` | Add X-Bridge-Session header, setBridgeSession export |
| `frontend/src/pages/Dashboard.tsx` | Replace wallet UI with pairing code |
| `frontend/src/styles/dashboard.css` | Pairing UI styles |
| `package.json` | Add `ws` dependency, `bridge` script |

### New dependencies
- `ws` (root package.json) — WebSocket server library

### No new frontend dependencies
Browser uses native `WebSocket` API.
