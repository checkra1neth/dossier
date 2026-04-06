# Rich Chat Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse plain-text chat responses and render them as rich, interactive React components with colored values, clickable addresses, chain badges, and contextual action buttons.

**Architecture:** Single file `formatMessage.tsx` exports `formatMessage()` which splits text by newlines, classifies each line, and renders micro-components. Inline elements (values, percents, addresses, chains) are parsed via a regex scanner. ChatPanel calls `formatMessage()` instead of raw text. CSS classes added to `dashboard.css`.

**Tech Stack:** React 18, TypeScript, CSS (oklch colors), no new dependencies.

---

### Task 1: Create formatMessage.tsx — inline formatter + line classifier

**Files:**
- Create: `frontend/src/components/formatMessage.tsx`

- [ ] **Step 1: Create the file with types and inline formatter**

```tsx
import React from "react";
import type { ReactNode } from "react";

export interface FormatContext {
  onCommand?: (cmd: string) => void;
}

// ── Known tokens (filtered to avoid false positives) ──
const KNOWN_TOKENS = new Set([
  "ETH","WETH","BTC","WBTC","USDC","USDT","DAI","LINK","UNI","AAVE",
  "COMP","MKR","SNX","CRV","BAL","SUSHI","YFI","MATIC","ARB","OP",
  "BASE","DEGEN","BRETT","TOSHI","L3","PEPE","SHIB","APE",
]);

const CHAINS = new Set([
  "ethereum","base","polygon","arbitrum","optimism","avalanche",
  "binance-smart-chain","fantom","gnosis","zksync","linea","scroll",
]);

// ── Inline micro-components ──

function ValueBadge({ text }: { text: string }): ReactNode {
  return <span className="fmt-value">{text}</span>;
}

function PercentBadge({ text }: { text: string }): ReactNode {
  const neg = text.startsWith("-");
  return <span className={`fmt-pct ${neg ? "neg" : "pos"}`}>{text}</span>;
}

function ArrowIcon({ up }: { up: boolean }): ReactNode {
  return <span className={`fmt-arrow ${up ? "up" : "down"}`}>{up ? "\u25B2" : "\u25BC"}</span>;
}

function AddressChip({ addr }: { addr: string }): ReactNode {
  const copy = () => { navigator.clipboard.writeText(addr); };
  return <button className="fmt-addr" onClick={copy} title="Copy address">{addr}</button>;
}

function ChainBadge({ chain }: { chain: string }): ReactNode {
  return <span className="fmt-chain">{chain}</span>;
}

function TokenChip({ symbol, onCommand }: { symbol: string; onCommand?: (cmd: string) => void }): ReactNode {
  const click = onCommand ? () => onCommand(`/quick ${symbol}`) : undefined;
  return <button className="fmt-token" onClick={click} disabled={!onCommand}>{symbol}</button>;
}

function YesNoBadge({ yes }: { yes: boolean }): ReactNode {
  return <span className={`fmt-yn ${yes ? "yes" : "no"}`}>{yes ? "YES" : "NO"}</span>;
}

// ── Inline regex scanner ──
// Finds the earliest match in `text`, renders it, continues with remainder.

function formatInline(text: string, ctx: FormatContext): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    const candidates: { type: string; idx: number; match: RegExpMatchArray }[] = [];

    const tryMatch = (type: string, re: RegExp) => {
      const m = rest.match(re);
      if (m && m.index !== undefined) candidates.push({ type, idx: m.index, match: m });
    };

    tryMatch("value",   /\$[\d,]+\.?\d*/);
    tryMatch("pct",     /[+-]\d+\.?\d*%/);
    tryMatch("arrow",   /[▲▼]/);
    tryMatch("addr",    /0x[a-fA-F0-9]{4,6}\.{2,3}[a-fA-F0-9]{3,4}/);
    tryMatch("chain",   /\[([\w-]+)\]/);
    tryMatch("bold",    /\*\*([^*]+)\*\*/);
    tryMatch("yesno",   /\b(YES|NO)\b/);
    // Token: uppercase 2-6 chars after ": " or at start, must be in known list
    tryMatch("token",   /(?<=[:,]\s)([A-Z][A-Z0-9]{1,5})(?=[\s,\n$]|$)/);

    if (candidates.length === 0) {
      parts.push(rest);
      break;
    }

    candidates.sort((a, b) => a.idx - b.idx);
    const first = candidates[0];
    const full = first.match[0];

    if (first.idx > 0) parts.push(rest.slice(0, first.idx));

    switch (first.type) {
      case "value":
        parts.push(<ValueBadge key={k++} text={full} />);
        break;
      case "pct":
        parts.push(<PercentBadge key={k++} text={full} />);
        break;
      case "arrow":
        parts.push(<ArrowIcon key={k++} up={full === "▲"} />);
        break;
      case "addr":
        parts.push(<AddressChip key={k++} addr={full} />);
        break;
      case "chain": {
        const chain = first.match[1];
        if (CHAINS.has(chain)) {
          parts.push(<ChainBadge key={k++} chain={chain} />);
        } else {
          parts.push(full);
        }
        break;
      }
      case "bold":
        parts.push(<strong key={k++}>{first.match[1]}</strong>);
        break;
      case "yesno":
        parts.push(<YesNoBadge key={k++} yes={full === "YES"} />);
        break;
      case "token": {
        const sym = first.match[1] || full;
        if (KNOWN_TOKENS.has(sym)) {
          parts.push(<TokenChip key={k++} symbol={sym} onCommand={ctx.onCommand} />);
        } else {
          parts.push(full);
        }
        break;
      }
    }

    rest = rest.slice(first.idx + full.length);
  }

  return parts;
}

// ── Line-level components ──

const CMD_EMOJI = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2694}\u{FE0F}]+)\s*(.+)/u;

function CommandHeader({ emoji, text, ctx }: { emoji: string; text: string; ctx: FormatContext }): ReactNode {
  return <div className="fmt-cmd-header"><span className="fmt-cmd-emoji">{emoji}</span>{formatInline(text, ctx)}</div>;
}

function Divider(): ReactNode {
  return <div className="fmt-divider" />;
}

function GroupHeader({ text, ctx }: { text: string; ctx: FormatContext }): ReactNode {
  return <div className="fmt-group">{formatInline(text.replace(/^▸\s*/, ""), ctx)}</div>;
}

function DetailRow({ text, ctx }: { text: string; ctx: FormatContext }): ReactNode {
  return <div className="fmt-detail">{formatInline(text.trimStart(), ctx)}</div>;
}

function TotalRow({ text, ctx }: { text: string; ctx: FormatContext }): ReactNode {
  return <div className="fmt-total">{formatInline(text, ctx)}</div>;
}

function OverflowHint({ text }: { text: string }): ReactNode {
  return <div className="fmt-overflow">{text}</div>;
}

function TextLine({ text, ctx }: { text: string; ctx: FormatContext }): ReactNode {
  return <div className="fmt-text">{formatInline(text, ctx)}</div>;
}

// ── Action bar ──

const ACTION_MAP: Record<string, { label: string; cmd: string }[]> = {
  "\u{1F4CA}": [{ label: "Research deeper", cmd: "/research" }, { label: "Check PnL", cmd: "/pnl" }],
  "\u{1F4B0}": [{ label: "Quick analysis", cmd: "/quick" }, { label: "History", cmd: "/history" }],
  "\u{1F4C8}": [{ label: "DeFi positions", cmd: "/defi" }, { label: "Compare", cmd: "/compare" }],
  "\u{1F3D7}": [{ label: "PnL report", cmd: "/pnl" }, { label: "NFTs", cmd: "/nft" }],
  "\u{1F4DC}": [{ label: "PnL report", cmd: "/pnl" }, { label: "DeFi", cmd: "/defi" }],
  "\u{1F5BC}": [{ label: "Quick analysis", cmd: "/quick" }],
};

function extractAddress(text: string): string | null {
  const m = text.match(/0x[a-fA-F0-9]{4,6}\.{2,3}[a-fA-F0-9]{3,4}/);
  return m ? m[0] : null;
}

function ActionBar({ text, ctx }: { text: string; ctx: FormatContext }): ReactNode {
  if (!ctx.onCommand) return null;
  const firstLine = text.split("\n")[0];
  // Find first emoji
  const emojiMatch = firstLine.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]+)/u);
  const emoji = emojiMatch?.[1];
  const actions = emoji ? ACTION_MAP[emoji] : undefined;
  if (!actions?.length) return null;

  const addr = extractAddress(text);

  return (
    <div className="fmt-actions">
      {actions.map((a) => (
        <button
          key={a.cmd}
          className="fmt-action-btn"
          onClick={() => ctx.onCommand!(`${a.cmd}${addr ? " " + addr : ""}`)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ── Main export ──

export function formatMessage(text: string, ctx?: FormatContext): ReactNode {
  const context = ctx || {};
  if (!text) return null;

  const lines = text.split("\n");
  const elements: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Empty line → spacer
    if (!trimmed) {
      elements.push(<div key={i} className="fmt-spacer" />);
      continue;
    }

    // Divider: box-drawing horizontal chars (━ or ─)
    if (/^[\u2500-\u257F]{3,}$/.test(trimmed)) {
      elements.push(<Divider key={i} />);
      continue;
    }

    // Overflow hint
    if (trimmed.trimStart().startsWith("... and ")) {
      elements.push(<OverflowHint key={i} text={trimmed.trimStart()} />);
      continue;
    }

    // Group header: starts with ▸
    if (trimmed.startsWith("▸")) {
      elements.push(<GroupHeader key={i} text={trimmed} ctx={context} />);
      continue;
    }

    // Detail row: 2+ space indent
    if (/^\s{2,}/.test(line) && trimmed.length > 0) {
      elements.push(<DetailRow key={i} text={trimmed} ctx={context} />);
      continue;
    }

    // Total row
    if (/^(Total:|💰\s*Total)/i.test(trimmed)) {
      elements.push(<TotalRow key={i} text={trimmed} ctx={context} />);
      continue;
    }

    // Command header: starts with emoji
    const cmdMatch = trimmed.match(CMD_EMOJI);
    if (cmdMatch && i < 3) {
      elements.push(<CommandHeader key={i} emoji={cmdMatch[1]} text={cmdMatch[2]} ctx={context} />);
      continue;
    }

    // Padded table row (compare): 15+ char label + value columns
    // Fallthrough to TextLine — the inline formatter handles values inside

    // Default: text line with inline formatting
    elements.push(<TextLine key={i} text={trimmed} ctx={context} />);
  }

  // Action bar at the bottom
  elements.push(<ActionBar key="actions" text={text} ctx={context} />);

  return <div className="fmt-msg">{elements}</div>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/pavelmackevic/Desktop/ows-intelligence-wire && npx tsc --noEmit`
Expected: Exit code 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/formatMessage.tsx
git commit -m "feat(chat): add formatMessage parser with inline components"
```

---

### Task 2: Add CSS classes for all format components

**Files:**
- Modify: `frontend/src/styles/dashboard.css` (append after line 535)

- [ ] **Step 1: Append format CSS to dashboard.css**

Add at the end of the file:

```css
/* ── Rich message formatting ── */
.fmt-msg { display: flex; flex-direction: column; gap: 2px; }
.fmt-spacer { height: 6px; }

/* Command header */
.fmt-cmd-header {
  font-size: 0.88rem; font-weight: 700; display: flex; align-items: center; gap: 6px;
  font-family: var(--font-display); margin-bottom: 4px;
}
.fmt-cmd-emoji { font-size: 1.1rem; }

/* Divider */
.fmt-divider { height: 1px; background: var(--sand-2); margin: 4px 0; }

/* Group header */
.fmt-group {
  font-weight: 600; font-size: 0.76rem; padding: 6px 10px;
  background: var(--sand-1); border-radius: 8px; margin-top: 4px;
}

/* Detail row */
.fmt-detail {
  font-size: 0.74rem; padding-left: 12px; line-height: 1.5;
  border-left: 2px solid var(--sand-2); margin-left: 6px;
}

/* Total row */
.fmt-total { font-weight: 600; font-size: 0.8rem; margin-top: 2px; }

/* Overflow hint */
.fmt-overflow { font-size: 0.7rem; color: var(--ink-muted); font-style: italic; padding-left: 12px; }

/* Text line */
.fmt-text { font-size: 0.76rem; line-height: 1.5; }

/* Value badge */
.fmt-value {
  font-weight: 600; color: oklch(30% 0.1 145);
  background: oklch(94% 0.03 145); padding: 1px 5px;
  border-radius: 4px; font-family: var(--font-mono); font-size: 0.74rem;
}

/* Percent badge */
.fmt-pct {
  font-weight: 600; padding: 1px 6px; border-radius: 10px;
  font-family: var(--font-mono); font-size: 0.68rem;
}
.fmt-pct.pos { background: oklch(92% 0.06 145); color: oklch(30% 0.12 145); }
.fmt-pct.neg { background: oklch(93% 0.05 25); color: oklch(35% 0.12 25); }

/* Arrow */
.fmt-arrow { font-size: 0.65rem; }
.fmt-arrow.up { color: oklch(45% 0.15 145); }
.fmt-arrow.down { color: oklch(45% 0.15 25); }

/* Address chip */
.fmt-addr {
  font-family: var(--font-mono); font-size: 0.68rem;
  background: var(--sand-1); border: 1px solid var(--sand-2);
  border-radius: 6px; padding: 1px 6px; cursor: pointer;
  transition: border-color 150ms;
}
.fmt-addr:hover { border-color: var(--accent); }

/* Chain badge */
.fmt-chain {
  font-size: 0.62rem; padding: 1px 6px; border-radius: 8px;
  background: var(--sand-1); border: 1px solid var(--sand-2);
  color: var(--ink-3); text-transform: capitalize;
}

/* Token chip */
.fmt-token {
  font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600;
  background: var(--sand-0); border: 1px solid var(--sand-2);
  border-left: 2px solid var(--accent); border-radius: 4px;
  padding: 0 5px; cursor: pointer; transition: all 150ms;
}
.fmt-token:hover { background: var(--sand-1); border-color: var(--accent); }
.fmt-token:disabled { cursor: default; }

/* Yes/No badge */
.fmt-yn { font-size: 0.68rem; font-weight: 600; padding: 1px 6px; border-radius: 8px; }
.fmt-yn.yes { background: oklch(92% 0.06 145); color: oklch(30% 0.12 145); }
.fmt-yn.no { background: oklch(93% 0.05 25); color: oklch(35% 0.12 25); }

/* Action bar */
.fmt-actions {
  display: flex; gap: 6px; margin-top: 8px; padding-top: 6px;
  border-top: 1px solid var(--sand-2);
}
.fmt-action-btn {
  font-size: 0.65rem; padding: 4px 10px; border-radius: 12px;
  border: 1px solid var(--sand-2); background: var(--sand-0);
  color: var(--ink-2); cursor: pointer; transition: all 150ms;
  font-weight: 500;
}
.fmt-action-btn:hover { background: var(--sand-1); border-color: var(--ink-3); color: var(--ink); }
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/pavelmackevic/Desktop/ows-intelligence-wire && npx tsc --noEmit`
Expected: Exit code 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/dashboard.css
git commit -m "style(chat): add rich formatting CSS classes"
```

---

### Task 3: Integrate formatMessage into ChatPanel

**Files:**
- Modify: `frontend/src/components/ChatPanel.tsx`

- [ ] **Step 1: Add import at the top of ChatPanel.tsx**

After the existing imports (line 3), add:

```tsx
import { formatMessage } from "./formatMessage";
import type { FormatContext } from "./formatMessage";
```

- [ ] **Step 2: Replace raw text rendering with formatMessage**

In the messages map (around line 219), change:

```tsx
<div className="chat-msg-bubble">
  <div className="chat-msg-text">{msg.text}</div>
  {msg.sender === "agent" && <CopyBtn text={msg.text} />}
</div>
```

To:

```tsx
<div className="chat-msg-bubble">
  <div className="chat-msg-text">
    {msg.sender === "agent"
      ? formatMessage(msg.text, { onCommand: doSend } as FormatContext)
      : msg.text}
  </div>
  {msg.sender === "agent" && <CopyBtn text={msg.text} />}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/pavelmackevic/Desktop/ows-intelligence-wire && npx tsc --noEmit`
Expected: Exit code 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChatPanel.tsx
git commit -m "feat(chat): integrate formatMessage for rich agent responses"
```

---

### Task 4: Adjust agent message bubble CSS for rich content

**Files:**
- Modify: `frontend/src/styles/dashboard.css`

- [ ] **Step 1: Update agent bubble styles**

The agent message bubble currently uses `white-space: pre-wrap` which conflicts with flex layout inside `fmt-msg`. Change the agent-specific rule:

Find (around line 454):
```css
.chat-msg.agent .chat-msg-text {
  background: var(--sand-1); color: var(--ink);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--sand-2);
}
```

Replace with:
```css
.chat-msg.agent .chat-msg-text {
  background: var(--sand-0); color: var(--ink);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--sand-2);
  white-space: normal;
}
```

Note: background changes from `sand-1` to `sand-0` (white) so the inner components (group headers, value badges) can use `sand-1` for contrast.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/dashboard.css
git commit -m "style(chat): adjust agent bubble for rich content layout"
```

---

### Task 5: Push and verify on Railway

**Files:** None (deployment)

- [ ] **Step 1: Push to trigger deploy**

```bash
cd /Users/pavelmackevic/Desktop/ows-intelligence-wire
git push origin main
```

- [ ] **Step 2: Wait for deploy and test**

Open `https://dossier.up.railway.app/app`, connect wallet, send `/help`, `/balance`, `/quick 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` in the chat.

Verify:
- `/help` renders with styled text (no raw pre-wrap)
- `/balance` shows value badges (green-tinted `$X.XX`), chain badges (pills), divider lines
- `/quick` shows command header with emoji, value badge, percent badge (green/red), arrow icon
- Action buttons appear below agent responses ("Research deeper", "Check PnL" etc.)
- Clicking an action button sends the corresponding command
- Clicking an address chip copies it to clipboard
- User messages still render as plain text (dark bubble)

- [ ] **Step 3: Done**
