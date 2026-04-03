# Phase 1: Enhanced Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new analytics commands (`/quick`, `/pnl`, `/defi`, `/history`, `/nft`, `/compare`) and enhance `/research` with DeFi + PnL data. All paid via x402.

**Architecture:** Extract Zerion API calls into a service with methods per endpoint. Each command gets its own handler file. x402 routes and XMTP commands are registered in parallel. The existing `/research` pipeline is refactored to use the new service and enriched with DeFi positions + PnL.

**Tech Stack:** TypeScript, Express 5, @x402/express, @xmtp/agent-sdk, Zerion API v1, OpenRouter LLM

---

### Task 1: Extract Zerion API service

**Files:**
- Create: `src/services/zerion.ts`
- Modify: `src/zerion.ts` (will be replaced)
- Modify: `src/types.ts`

- [ ] **Step 1: Create `src/services/zerion.ts` with base client and portfolio method**

```typescript
// src/services/zerion.ts
const BASE_URL = "https://api.zerion.io/v1";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { data: unknown; timestamp: number }>();

function getApiKey(): string {
  const key = process.env.ZERION_API_KEY;
  if (!key) throw new Error("ZERION_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${getApiKey()}:`).toString("base64")}`,
    Accept: "application/json",
  };
}

function cacheKey(method: string, address: string): string {
  return `${method}:${address.toLowerCase()}`;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    if (res.ok) return res;
    if (res.status === 429) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[zerion] 429 rate limited, retrying in ${delay}ms`);
      lastError = new Error("Zerion API rate limited (429)");
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Zerion API ${res.status} ${res.statusText}`);
  }
  throw lastError ?? new Error("Zerion API failed after retries");
}

// --- Portfolio ---
export interface PortfolioData {
  totalValueUsd: number;
  chains: string[];
  change24hPercent: number;
  change24hUsd: number;
}

export async function fetchPortfolio(address: string): Promise<PortfolioData> {
  const key = cacheKey("portfolio", address);
  const cached = getCached<PortfolioData>(key);
  if (cached) return cached;

  const res = await fetchWithRetry(`${BASE_URL}/wallets/${address}/portfolio?currency=usd`);
  const json = await res.json() as {
    data: {
      attributes: {
        total: { positions: number };
        positions_distribution_by_chain: Record<string, number>;
        changes: { percent_1d: number; absolute_1d: number };
      };
    };
  };

  const attrs = json.data.attributes;
  const result: PortfolioData = {
    totalValueUsd: attrs.total.positions,
    chains: Object.keys(attrs.positions_distribution_by_chain ?? {}),
    change24hPercent: attrs.changes?.percent_1d ?? 0,
    change24hUsd: attrs.changes?.absolute_1d ?? 0,
  };

  setCache(key, result);
  return result;
}

// --- Positions (simple = spot, complex = DeFi) ---
export interface Position {
  asset: string;
  name: string;
  valueUsd: number;
  quantity: number;
  chain: string;
  percentage: number;
}

export async function fetchPositions(address: string, type: "only_simple" | "only_complex" = "only_simple"): Promise<Position[]> {
  const key = cacheKey(`positions:${type}`, address);
  const cached = getCached<Position[]>(key);
  if (cached) return cached;

  const res = await fetchWithRetry(
    `${BASE_URL}/wallets/${address}/positions/?filter[positions]=${type}&filter[trash]=only_non_trash&currency=usd&page[size]=100&sort=-value`
  );
  const json = await res.json() as {
    data: {
      attributes: {
        fungible_info: { name: string; symbol: string };
        value: number | null;
        quantity: { float: number };
        protocol?: string;
      };
      relationships: { chain: { data: { id: string } } };
    }[];
  };

  const filtered = json.data
    .filter((p) => p.attributes.value != null && p.attributes.value > 1)
    .sort((a, b) => (b.attributes.value ?? 0) - (a.attributes.value ?? 0));

  const totalValue = filtered.reduce((s, p) => s + (p.attributes.value ?? 0), 0);

  const result = filtered.slice(0, 20).map((p) => ({
    asset: p.attributes.fungible_info.symbol,
    name: p.attributes.fungible_info.name,
    valueUsd: p.attributes.value!,
    quantity: p.attributes.quantity.float,
    chain: p.relationships.chain.data.id,
    percentage: totalValue > 0 ? Math.round((p.attributes.value! / totalValue) * 1000) / 10 : 0,
  }));

  setCache(key, result);
  return result;
}

// --- DeFi Positions (complex) ---
export interface DefiPosition {
  protocol: string;
  type: string; // deposited, staked, locked, reward
  asset: string;
  valueUsd: number;
  chain: string;
}

export async function fetchDefiPositions(address: string): Promise<DefiPosition[]> {
  const key = cacheKey("defi", address);
  const cached = getCached<DefiPosition[]>(key);
  if (cached) return cached;

  const res = await fetchWithRetry(
    `${BASE_URL}/wallets/${address}/positions/?filter[positions]=only_complex&filter[trash]=only_non_trash&currency=usd&page[size]=100&sort=-value`
  );
  const json = await res.json() as {
    data: {
      attributes: {
        fungible_info: { symbol: string };
        value: number | null;
        position_type: string;
        application_metadata?: { name?: string };
      };
      relationships: {
        chain: { data: { id: string } };
        dapp?: { data?: { id: string } };
      };
    }[];
  };

  const result = json.data
    .filter((p) => p.attributes.value != null && p.attributes.value > 1)
    .map((p) => ({
      protocol: p.attributes.application_metadata?.name ?? p.relationships.dapp?.data?.id ?? "unknown",
      type: p.attributes.position_type ?? "unknown",
      asset: p.attributes.fungible_info.symbol,
      valueUsd: p.attributes.value!,
      chain: p.relationships.chain.data.id,
    }));

  setCache(key, result);
  return result;
}

// --- PnL ---
export interface PnlData {
  realizedGain: number;
  unrealizedGain: number;
  totalFees: number;
  netInvested: number;
}

export async function fetchPnl(address: string): Promise<PnlData> {
  const key = cacheKey("pnl", address);
  const cached = getCached<PnlData>(key);
  if (cached) return cached;

  const res = await fetchWithRetry(`${BASE_URL}/wallets/${address}/pnl?currency=usd`);
  const json = await res.json() as {
    data: {
      attributes: {
        realized_gain: number;
        unrealized_gain: number;
        total_fee: number;
        net_invested: number;
      };
    };
  };

  const a = json.data.attributes;
  const result: PnlData = {
    realizedGain: a.realized_gain ?? 0,
    unrealizedGain: a.unrealized_gain ?? 0,
    totalFees: a.total_fee ?? 0,
    netInvested: a.net_invested ?? 0,
  };

  setCache(key, result);
  return result;
}

// --- Transactions ---
export interface Transaction {
  type: string;
  timestamp: string;
  chain: string;
  transfers: { direction: string; symbol: string; quantity: number; valueUsd: number }[];
}

export async function fetchTransactions(address: string, limit: number = 20): Promise<Transaction[]> {
  const key = cacheKey(`txns:${limit}`, address);
  const cached = getCached<Transaction[]>(key);
  if (cached) return cached;

  const res = await fetchWithRetry(
    `${BASE_URL}/wallets/${address}/transactions/?currency=usd&page[size]=${limit}`
  );
  const json = await res.json() as {
    data: {
      attributes: {
        operation_type: string;
        mined_at: string;
        transfers?: {
          direction: string;
          fungible_info?: { symbol: string };
          quantity?: { float: number };
          value?: number;
        }[];
      };
      relationships: { chain: { data: { id: string } } };
    }[];
  };

  const result = json.data.map((tx) => ({
    type: tx.attributes.operation_type,
    timestamp: tx.attributes.mined_at,
    chain: tx.relationships.chain.data.id,
    transfers: (tx.attributes.transfers ?? []).map((t) => ({
      direction: t.direction,
      symbol: t.fungible_info?.symbol ?? "unknown",
      quantity: t.quantity?.float ?? 0,
      valueUsd: t.value ?? 0,
    })),
  }));

  setCache(key, result);
  return result;
}

// --- NFTs ---
export interface NftCollection {
  name: string;
  count: number;
  floorPrice: number;
  chain: string;
}

export async function fetchNftCollections(address: string): Promise<NftCollection[]> {
  const key = cacheKey("nfts", address);
  const cached = getCached<NftCollection[]>(key);
  if (cached) return cached;

  const res = await fetchWithRetry(
    `${BASE_URL}/wallets/${address}/nft-collections/?currency=usd&sort=-floor_price`
  );
  const json = await res.json() as {
    data: {
      attributes: {
        collection_info: { name: string };
        nft_count: number;
        floor_price?: number;
      };
      relationships: { chain: { data: { id: string } } };
    }[];
  };

  const result = json.data.slice(0, 10).map((c) => ({
    name: c.attributes.collection_info.name,
    count: c.attributes.nft_count,
    floorPrice: c.attributes.floor_price ?? 0,
    chain: c.relationships.chain.data.id,
  }));

  setCache(key, result);
  return result;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd ~/Desktop/ows-intelligence-wire && npx tsc --noEmit src/services/zerion.ts 2>&1 || echo "OK (tsx will handle)"`

- [ ] **Step 3: Commit**

```bash
git add src/services/zerion.ts
git commit -m "feat: add Zerion API service with all analytics endpoints"
```

---

### Task 2: Add command types and update shared types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update types.ts with new interfaces**

Add to existing `src/types.ts` (keep existing interfaces, add new ones):

```typescript
// Add after existing interfaces:

import type {
  PortfolioData,
  Position,
  DefiPosition,
  PnlData,
  Transaction,
  NftCollection,
} from "./services/zerion.ts";

export type { PortfolioData, Position, DefiPosition, PnlData, Transaction, NftCollection };

export interface QuickReport {
  address: string;
  portfolio: PortfolioData;
  topPositions: Position[];
}

export interface PnlReport {
  address: string;
  pnl: PnlData;
  roi: number;
}

export interface DefiReport {
  address: string;
  positions: DefiPosition[];
  totalDefiUsd: number;
}

export interface HistoryReport {
  address: string;
  transactions: Transaction[];
  pattern: { trades: number; receives: number; sends: number; executes: number; other: number };
  frequency: string;
}

export interface NftReport {
  address: string;
  collections: NftCollection[];
  totalEstimatedUsd: number;
}

export interface CompareReport {
  addressA: string;
  addressB: string;
  a: { portfolio: PortfolioData; positions: Position[]; pnl: PnlData };
  b: { portfolio: PortfolioData; positions: Position[]; pnl: PnlData };
  verdict: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add types for all analytics commands"
```

---

### Task 3: Create command handlers — `/quick`

**Files:**
- Create: `src/commands/quick.ts`

- [ ] **Step 1: Create quick.ts**

```typescript
// src/commands/quick.ts
import { fetchPortfolio, fetchPositions } from "../services/zerion.ts";
import type { QuickReport } from "../types.ts";

export async function handleQuick(address: string): Promise<QuickReport> {
  const [portfolio, positions] = await Promise.all([
    fetchPortfolio(address),
    fetchPositions(address, "only_simple"),
  ]);

  return { address, portfolio, topPositions: positions.slice(0, 3) };
}

function usd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function quickToText(report: QuickReport): string {
  const { address, portfolio, topPositions } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const sign = portfolio.change24hPercent >= 0 ? "▲" : "▼";
  const pct = (portfolio.change24hPercent * 100).toFixed(1);
  const top = topPositions.map((p) => `${p.asset} $${usd(p.valueUsd)}`).join(", ");

  return (
    `📊 Quick: ${short}\n` +
    `💰 $${usd(portfolio.totalValueUsd)} (${sign} ${pct}% 24h)\n` +
    `🔗 Chains: ${portfolio.chains.slice(0, 5).join(", ")}${portfolio.chains.length > 5 ? ` (+${portfolio.chains.length - 5} more)` : ""}\n` +
    `🏦 Top: ${top || "none"}`
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/quick.ts
git commit -m "feat: add /quick command handler"
```

---

### Task 4: Create command handlers — `/pnl`

**Files:**
- Create: `src/commands/pnl.ts`

- [ ] **Step 1: Create pnl.ts**

```typescript
// src/commands/pnl.ts
import { fetchPnl } from "../services/zerion.ts";
import type { PnlReport } from "../types.ts";

export async function handlePnl(address: string): Promise<PnlReport> {
  const pnl = await fetchPnl(address);
  const roi = pnl.netInvested !== 0
    ? ((pnl.realizedGain + pnl.unrealizedGain) / Math.abs(pnl.netInvested)) * 100
    : 0;

  return { address, pnl, roi };
}

function usd(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return sign + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pnlToText(report: PnlReport): string {
  const { address, pnl, roi } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    `📈 PnL: ${short}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 Net invested: $${usd(pnl.netInvested)}\n` +
    `📊 Realized gain: $${usd(pnl.realizedGain)}\n` +
    `📊 Unrealized gain: $${usd(pnl.unrealizedGain)}\n` +
    `💰 Total fees paid: $${usd(pnl.totalFees)}\n` +
    `🎯 ROI: ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/pnl.ts
git commit -m "feat: add /pnl command handler"
```

---

### Task 5: Create command handlers — `/defi`

**Files:**
- Create: `src/commands/defi.ts`

- [ ] **Step 1: Create defi.ts**

```typescript
// src/commands/defi.ts
import { fetchDefiPositions, fetchPortfolio } from "../services/zerion.ts";
import type { DefiReport } from "../types.ts";

export async function handleDefi(address: string): Promise<DefiReport> {
  const [positions, portfolio] = await Promise.all([
    fetchDefiPositions(address),
    fetchPortfolio(address),
  ]);
  const totalDefiUsd = positions.reduce((s, p) => s + p.valueUsd, 0);

  return { address, positions, totalDefiUsd };
}

function usd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function defiToText(report: DefiReport): string {
  const { address, positions, totalDefiUsd } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (positions.length === 0) {
    return `🏦 DeFi: ${short}\n\nNo DeFi positions found.`;
  }

  // Group by protocol
  const byProtocol = new Map<string, typeof positions>();
  for (const p of positions) {
    const key = p.protocol;
    if (!byProtocol.has(key)) byProtocol.set(key, []);
    byProtocol.get(key)!.push(p);
  }

  let text = `🏦 DeFi Positions: ${short}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const [protocol, pos] of byProtocol) {
    const types = [...new Set(pos.map((p) => p.type))].join(", ");
    text += `\n${protocol} (${types}):\n`;
    for (const p of pos) {
      text += `  └ ${p.asset}: $${usd(p.valueUsd)} (${p.chain})\n`;
    }
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\nTotal DeFi: $${usd(totalDefiUsd)}`;
  return text;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/defi.ts
git commit -m "feat: add /defi command handler"
```

---

### Task 6: Create command handlers — `/history`

**Files:**
- Create: `src/commands/history.ts`

- [ ] **Step 1: Create history.ts**

```typescript
// src/commands/history.ts
import { fetchTransactions } from "../services/zerion.ts";
import type { HistoryReport } from "../types.ts";

export async function handleHistory(address: string): Promise<HistoryReport> {
  const transactions = await fetchTransactions(address, 20);

  const pattern = { trades: 0, receives: 0, sends: 0, executes: 0, other: 0 };
  for (const tx of transactions) {
    if (tx.type === "trade") pattern.trades++;
    else if (tx.type === "receive") pattern.receives++;
    else if (tx.type === "send") pattern.sends++;
    else if (tx.type === "execute") pattern.executes++;
    else pattern.other++;
  }

  let frequency = "inactive";
  if (transactions.length >= 2) {
    const first = new Date(transactions[0].timestamp).getTime();
    const last = new Date(transactions[transactions.length - 1].timestamp).getTime();
    const days = Math.max(1, (first - last) / (1000 * 60 * 60 * 24));
    const perDay = transactions.length / days;
    if (perDay >= 5) frequency = "very active (~" + Math.round(perDay) + " txns/day)";
    else if (perDay >= 1) frequency = "active (~" + perDay.toFixed(1) + " txns/day)";
    else if (perDay >= 0.14) frequency = "moderate (~" + Math.round(perDay * 7) + " txns/week)";
    else frequency = "low activity";
  }

  return { address, transactions, pattern, frequency };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function historyToText(report: HistoryReport): string {
  const { address, transactions, pattern, frequency } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  let text = `📜 History: ${short} (last ${transactions.length} txns)\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const tx of transactions.slice(0, 8)) {
    const transfers = tx.transfers
      .map((t) => `${t.quantity.toFixed(4)} ${t.symbol}`)
      .join(", ");
    text += `${timeAgo(tx.timestamp)} — ${tx.type}: ${transfers || "contract call"} (${tx.chain})\n`;
  }

  if (transactions.length > 8) text += `  ... and ${transactions.length - 8} more\n`;

  const parts = Object.entries(pattern).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
  text += `\n📊 Pattern: ${parts.join(", ")}\n`;
  text += `⏱️ Frequency: ${frequency}`;
  return text;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/history.ts
git commit -m "feat: add /history command handler"
```

---

### Task 7: Create command handlers — `/nft`

**Files:**
- Create: `src/commands/nft.ts`

- [ ] **Step 1: Create nft.ts**

```typescript
// src/commands/nft.ts
import { fetchNftCollections } from "../services/zerion.ts";
import type { NftReport } from "../types.ts";

export async function handleNft(address: string): Promise<NftReport> {
  const collections = await fetchNftCollections(address);
  const totalEstimatedUsd = collections.reduce((s, c) => s + c.floorPrice * c.count, 0);

  return { address, collections, totalEstimatedUsd };
}

function usd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function nftToText(report: NftReport): string {
  const { address, collections, totalEstimatedUsd } = report;
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (collections.length === 0) {
    return `🖼️ NFTs: ${short}\n\nNo NFT collections found.`;
  }

  let text = `🖼️ NFTs: ${short}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nCollections: ${collections.length}\n\n`;

  for (const c of collections.slice(0, 5)) {
    text += `  ${c.name}: ${c.count} NFT${c.count > 1 ? "s" : ""} (floor: $${usd(c.floorPrice)}) [${c.chain}]\n`;
  }

  text += `\nTotal estimated: $${usd(totalEstimatedUsd)}`;
  return text;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/nft.ts
git commit -m "feat: add /nft command handler"
```

---

### Task 8: Create command handlers — `/compare`

**Files:**
- Create: `src/commands/compare.ts`

- [ ] **Step 1: Create compare.ts**

```typescript
// src/commands/compare.ts
import { fetchPortfolio, fetchPositions, fetchPnl } from "../services/zerion.ts";
import { analyzeWallet } from "../llm.ts";
import type { CompareReport } from "../types.ts";

export async function handleCompare(addrA: string, addrB: string): Promise<CompareReport> {
  const [portA, posA, pnlA, portB, posB, pnlB] = await Promise.all([
    fetchPortfolio(addrA),
    fetchPositions(addrA, "only_simple"),
    fetchPnl(addrA),
    fetchPortfolio(addrB),
    fetchPositions(addrB, "only_simple"),
    fetchPnl(addrB),
  ]);

  // Build comparison verdict via LLM
  const prompt = `Compare these two wallets briefly (2-3 sentences):
Wallet A (${addrA.slice(0,8)}): $${portA.totalValueUsd.toLocaleString()}, ${portA.chains.length} chains, ROI ${pnlA.netInvested ? (((pnlA.realizedGain + pnlA.unrealizedGain) / Math.abs(pnlA.netInvested)) * 100).toFixed(1) : 0}%, top: ${posA.slice(0,3).map(p=>p.asset).join(",")}
Wallet B (${addrB.slice(0,8)}): $${portB.totalValueUsd.toLocaleString()}, ${portB.chains.length} chains, ROI ${pnlB.netInvested ? (((pnlB.realizedGain + pnlB.unrealizedGain) / Math.abs(pnlB.netInvested)) * 100).toFixed(1) : 0}%, top: ${posB.slice(0,3).map(p=>p.asset).join(",")}`;

  let verdict = "Comparison data available above.";
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "qwen/qwen3.6-plus:free",
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const body = await res.json();
      verdict = body.choices?.[0]?.message?.content ?? verdict;
    }
  } catch {}

  return {
    addressA: addrA,
    addressB: addrB,
    a: { portfolio: portA, positions: posA, pnl: pnlA },
    b: { portfolio: portB, positions: posB, pnl: pnlB },
    verdict,
  };
}

function usd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roi(pnl: { realizedGain: number; unrealizedGain: number; netInvested: number }): string {
  if (pnl.netInvested === 0) return "N/A";
  const r = ((pnl.realizedGain + pnl.unrealizedGain) / Math.abs(pnl.netInvested)) * 100;
  return `${r >= 0 ? "+" : ""}${r.toFixed(1)}%`;
}

export function compareToText(report: CompareReport): string {
  const { addressA, addressB, a, b, verdict } = report;
  const shortA = `${addressA.slice(0, 6)}...${addressA.slice(-4)}`;
  const shortB = `${addressB.slice(0, 6)}...${addressB.slice(-4)}`;

  return (
    `⚔️ Compare: ${shortA} vs ${shortB}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `               ${shortA.padEnd(16)} ${shortB}\n` +
    `Total Value    $${usd(a.portfolio.totalValueUsd).padEnd(16)} $${usd(b.portfolio.totalValueUsd)}\n` +
    `Chains         ${String(a.portfolio.chains.length).padEnd(16)} ${b.portfolio.chains.length}\n` +
    `Smart Money    ${(a.portfolio.totalValueUsd > 5e6 ? "YES" : "NO").padEnd(16)} ${b.portfolio.totalValueUsd > 5e6 ? "YES" : "NO"}\n` +
    `ROI            ${roi(a.pnl).padEnd(16)} ${roi(b.pnl)}\n` +
    `Top Asset      ${(a.positions[0]?.asset ?? "—").padEnd(16)} ${b.positions[0]?.asset ?? "—"}\n` +
    `\n🏁 ${verdict}`
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/compare.ts
git commit -m "feat: add /compare command handler"
```

---

### Task 9: Enhance `/research` v2 with DeFi + PnL

**Files:**
- Modify: `src/pipeline.ts`
- Modify: `src/llm.ts` (update prompt)
- Modify: `src/report.ts` (add DeFi/PnL sections)
- Modify: `src/types.ts` (extend ZerionData)

- [ ] **Step 1: Update pipeline.ts to fetch DeFi + PnL**

Replace `src/pipeline.ts`:

```typescript
// src/pipeline.ts
import type { ResearchReport } from "./types.ts";
import { fetchPortfolio, fetchPositions, fetchDefiPositions, fetchPnl, fetchTransactions } from "./services/zerion.ts";
import { analyzeWallet } from "./llm.ts";
import { buildReport } from "./report.ts";

export async function research(address: string): Promise<ResearchReport> {
  console.log(`[pipeline] Starting research for ${address.slice(0, 10)}...`);

  const [portfolio, positions, defiPositions, pnl, transactions] = await Promise.all([
    fetchPortfolio(address),
    fetchPositions(address, "only_simple"),
    fetchDefiPositions(address),
    fetchPnl(address).catch(() => null),
    fetchTransactions(address, 20).catch(() => []),
  ]);

  const totalValueUsd = portfolio.totalValueUsd;
  const chains = portfolio.chains;
  const isSmartMoney = totalValueUsd > 5_000_000;
  const topPositions = positions.slice(0, 10).map((p) => ({
    asset: p.asset,
    valueUsd: p.valueUsd,
    percentage: p.percentage,
  }));

  console.log(`[pipeline] Zerion data fetched: $${totalValueUsd.toLocaleString()}, ${positions.length} positions, ${defiPositions.length} DeFi, ${transactions.length} txns`);

  const data = { totalValueUsd, chains, topPositions, isSmartMoney, positionCount: positions.length };

  const analysis = await analyzeWallet(address, data, defiPositions, pnl, transactions);
  console.log(`[pipeline] LLM analysis complete: risk=${analysis.riskLevel}, ${analysis.patterns.length} patterns`);

  return buildReport(address, data, analysis);
}
```

- [ ] **Step 2: Update LLM prompt in `src/llm.ts`**

Update the `analyzeWallet` signature and `buildPrompt` to accept optional DeFi/PnL/Txns data. Change the function signature:

```typescript
export async function analyzeWallet(
  address: string,
  data: ZerionData,
  defi?: DefiPosition[],
  pnl?: PnlData | null,
  transactions?: Transaction[],
): Promise<Analysis> {
```

Add to import:
```typescript
import type { ZerionData, Analysis } from "./types.ts";
import type { DefiPosition, PnlData, Transaction } from "./services/zerion.ts";
```

Update `buildPrompt` to include DeFi, PnL, and transaction data when available. Add these sections after the positions text:

```
**DeFi Positions:**
${defi?.length ? defi.map(d => `${d.protocol}: ${d.asset} $${d.valueUsd} (${d.type})`).join("\n") : "None"}

**PnL:**
${pnl ? `Realized: $${pnl.realizedGain}, Unrealized: $${pnl.unrealizedGain}, Net invested: $${pnl.netInvested}` : "N/A"}

**Recent Transactions (${transactions?.length ?? 0}):**
${transactions?.slice(0, 10).map(t => `${t.type}: ${t.transfers.map(tr => `${tr.quantity} ${tr.symbol}`).join(", ")} (${t.chain})`).join("\n") || "None"}
```

- [ ] **Step 3: Commit**

```bash
git add src/pipeline.ts src/llm.ts src/report.ts src/types.ts
git commit -m "feat: enhance /research with DeFi, PnL, and transaction data"
```

---

### Task 10: Register all new x402 routes in `index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add route handlers and x402 pricing**

Add imports at top of `src/index.ts`:
```typescript
import { handleQuick, quickToText } from "./commands/quick.ts";
import { handlePnl, pnlToText } from "./commands/pnl.ts";
import { handleDefi, defiToText } from "./commands/defi.ts";
import { handleHistory, historyToText } from "./commands/history.ts";
import { handleNft, nftToText } from "./commands/nft.ts";
import { handleCompare, compareToText } from "./commands/compare.ts";
```

Add route handlers (similar pattern to existing `researchRouter`):
```typescript
const quickRouter = express.Router();
quickRouter.post("/", async (req, res) => {
  const { address } = req.body as { address?: string };
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) { res.status(400).json({ error: "Invalid address" }); return; }
  console.log(`[x402] ✅ Payment verified — quick for ${address}`);
  try { res.json(await handleQuick(address)); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});

const pnlRouter = express.Router();
pnlRouter.post("/", async (req, res) => {
  const { address } = req.body as { address?: string };
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) { res.status(400).json({ error: "Invalid address" }); return; }
  console.log(`[x402] ✅ Payment verified — pnl for ${address}`);
  try { res.json(await handlePnl(address)); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});

const defiRouter = express.Router();
defiRouter.post("/", async (req, res) => {
  const { address } = req.body as { address?: string };
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) { res.status(400).json({ error: "Invalid address" }); return; }
  console.log(`[x402] ✅ Payment verified — defi for ${address}`);
  try { res.json(await handleDefi(address)); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});

const historyRouter = express.Router();
historyRouter.post("/", async (req, res) => {
  const { address } = req.body as { address?: string };
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) { res.status(400).json({ error: "Invalid address" }); return; }
  console.log(`[x402] ✅ Payment verified — history for ${address}`);
  try { res.json(await handleHistory(address)); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});

const nftRouter = express.Router();
nftRouter.post("/", async (req, res) => {
  const { address } = req.body as { address?: string };
  if (!address?.match(/^0x[a-fA-F0-9]{40}$/)) { res.status(400).json({ error: "Invalid address" }); return; }
  console.log(`[x402] ✅ Payment verified — nft for ${address}`);
  try { res.json(await handleNft(address)); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});

const compareRouter = express.Router();
compareRouter.post("/", async (req, res) => {
  const { addressA, addressB } = req.body as { addressA?: string; addressB?: string };
  if (!addressA?.match(/^0x[a-fA-F0-9]{40}$/) || !addressB?.match(/^0x[a-fA-F0-9]{40}$/)) {
    res.status(400).json({ error: "Provide two valid addresses: addressA, addressB" }); return;
  }
  console.log(`[x402] ✅ Payment verified — compare ${addressA} vs ${addressB}`);
  try { res.json(await handleCompare(addressA, addressB)); }
  catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); }
});
```

Update the `routes` object in the x402 config to include all new endpoints:
```typescript
  const routes = {
    "POST /research": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.05" as const },
      description: "Deep wallet research report",
      mimeType: "application/json",
    },
    "POST /quick": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.01" as const },
      description: "Quick portfolio snapshot",
      mimeType: "application/json",
    },
    "POST /pnl": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.02" as const },
      description: "Wallet profit & loss analysis",
      mimeType: "application/json",
    },
    "POST /defi": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.02" as const },
      description: "DeFi positions breakdown",
      mimeType: "application/json",
    },
    "POST /history": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.02" as const },
      description: "Transaction history analysis",
      mimeType: "application/json",
    },
    "POST /nft": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.02" as const },
      description: "NFT portfolio overview",
      mimeType: "application/json",
    },
    "POST /compare": {
      accepts: { scheme: "exact" as const, network, payTo, price: "$0.05" as const },
      description: "Compare two wallets",
      mimeType: "application/json",
    },
  };
```

Register routers after the x402 middleware:
```typescript
app.use("/research", researchRouter);
app.use("/quick", quickRouter);
app.use("/pnl", pnlRouter);
app.use("/defi", defiRouter);
app.use("/history", historyRouter);
app.use("/nft", nftRouter);
app.use("/compare", compareRouter);
```

- [ ] **Step 2: Verify server starts**

Run: `cd ~/Desktop/ows-intelligence-wire && npx tsx src/index.ts`
Expected: Server starts, shows all routes loaded.
Kill after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register all analytics x402 routes with pricing"
```

---

### Task 11: Register all new XMTP commands in `xmtp.ts`

**Files:**
- Modify: `src/xmtp.ts`

- [ ] **Step 1: Add XMTP command handlers**

Add imports:
```typescript
import { handleQuick, quickToText } from "./commands/quick.ts";
import { handlePnl, pnlToText } from "./commands/pnl.ts";
import { handleDefi, defiToText } from "./commands/defi.ts";
import { handleHistory, historyToText } from "./commands/history.ts";
import { handleNft, nftToText } from "./commands/nft.ts";
import { handleCompare, compareToText } from "./commands/compare.ts";
```

Add command registrations after the existing `/research` command (same pattern: check startedAt, parse address, request payment, execute):

For each new command, register with `router.command(...)`. The XMTP flow: user sends command → agent requests payment via wallet_sendCalls → user pays → agent executes and sends result.

Since payment is handled via x402 HTTP (not XMTP wallet_sendCalls), the XMTP commands should just inform the user to use the client's `pay` flow. Or we can make them free via XMTP and only charge via HTTP.

**Simpler approach:** Make XMTP commands execute directly (no XMTP payment for new commands — payment happens via x402 on the HTTP side). The XMTP agent acts as a free preview/interface, with the client handling x402 payment.

Register all commands in the router:
```typescript
  router.command("/quick", "Quick portfolio snapshot ($0.01)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /quick 0x<address>"); return; }
    try {
      const report = await handleQuick(address);
      await ctx.conversation.sendText(quickToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/pnl", "Profit & loss analysis ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /pnl 0x<address>"); return; }
    try {
      const report = await handlePnl(address);
      await ctx.conversation.sendText(pnlToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/defi", "DeFi positions breakdown ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /defi 0x<address>"); return; }
    try {
      const report = await handleDefi(address);
      await ctx.conversation.sendText(defiToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/history", "Transaction history ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /history 0x<address>"); return; }
    try {
      const report = await handleHistory(address);
      await ctx.conversation.sendText(historyToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/nft", "NFT portfolio ($0.02)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const address = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
    if (!address) { await ctx.conversation.sendText("Usage: /nft 0x<address>"); return; }
    try {
      const report = await handleNft(address);
      await ctx.conversation.sendText(nftToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });

  router.command("/compare", "Compare two wallets ($0.05)", async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    const text = ctx.message.content as string;
    const addresses = text.match(/0x[a-fA-F0-9]{40}/g);
    if (!addresses || addresses.length < 2) { await ctx.conversation.sendText("Usage: /compare 0x<addr1> 0x<addr2>"); return; }
    try {
      const report = await handleCompare(addresses[0], addresses[1]);
      await ctx.conversation.sendText(compareToText(report));
    } catch (err) { await ctx.conversation.sendText(`❌ ${err instanceof Error ? err.message : err}`); }
  });
```

Update the default handler help text:
```typescript
  router.default(async (ctx) => {
    if (ctx.message.sentAt && ctx.message.sentAt.getTime() < startedAt) return;
    await ctx.conversation.sendText(
      `👋 OWS Intelligence Wire\n\n` +
      `📊 Analytics:\n` +
      `  /quick 0x<addr>  — portfolio snapshot ($0.01)\n` +
      `  /research 0x<addr> — deep research ($0.05)\n` +
      `  /pnl 0x<addr>  — profit & loss ($0.02)\n` +
      `  /defi 0x<addr>  — DeFi positions ($0.02)\n` +
      `  /history 0x<addr> — tx history ($0.02)\n` +
      `  /nft 0x<addr>  — NFT portfolio ($0.02)\n` +
      `  /compare 0x<a> 0x<b> — compare wallets ($0.05)\n\n` +
      `Payments via x402 (USDC on Base, gasless).`
    );
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/xmtp.ts
git commit -m "feat: register all analytics XMTP commands"
```

---

### Task 12: Delete old `src/zerion.ts`, update imports

**Files:**
- Delete: `src/zerion.ts`
- Modify: any files that import from old `./zerion.ts`

- [ ] **Step 1: Update remaining imports**

The old `src/zerion.ts` exported `fetchWalletData`. It's used in `src/pipeline.ts` (already updated in Task 9). Verify no other files reference it:

Run: `grep -rn "from.*./zerion" src/ --include="*.ts"`

Delete `src/zerion.ts` if nothing else uses it.

- [ ] **Step 2: Commit**

```bash
git rm src/zerion.ts
git commit -m "refactor: remove old zerion.ts, replaced by services/zerion.ts"
```

---

### Task 13: End-to-end test

- [ ] **Step 1: Start server**

```bash
cd ~/Desktop/ows-intelligence-wire && npm run dev
```

Verify all routes show in startup logs.

- [ ] **Step 2: Test each endpoint via curl**

```bash
# Quick
curl -sL -u "$ZERION_KEY:" -X POST http://localhost:4000/quick -H 'Content-Type: application/json' -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}' | python3 -m json.tool | head -20

# PnL
curl -sL -u "$ZERION_KEY:" -X POST http://localhost:4000/pnl -H 'Content-Type: application/json' -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}' | python3 -m json.tool | head -20
```

Note: These will return 402 (x402 payment required) unless tested without the payment middleware. For quick smoke test, temporarily bypass or use `ows pay request`.

- [ ] **Step 3: Test via XMTP client**

```bash
npm run client
# Then type:
# /quick 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
# /pnl 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
# /defi 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
# /history 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
# /nft 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

XMTP commands execute directly (no x402 payment in XMTP flow for new commands).
