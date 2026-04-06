import React from "react";
import type { ReactNode } from "react";

export interface FormatContext {
  onCommand?: (cmd: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAINS — extended set matching server output
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAINS = new Set([
  "ethereum","base","polygon","arbitrum","optimism","avalanche",
  "binance-smart-chain","fantom","gnosis","zksync","linea","scroll",
  "blast","aurora","polygon-zkevm","zksync-era","abstract","ape",
  "hyperevm","zero","celo","mantle","mode","sei",
]);

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO-COMPONENTS — tiny, purposeful render atoms
   ═══════════════════════════════════════════════════════════════════════════ */

function Val({ text }: { text: string }): ReactNode {
  return <span className="f-val">{text}</span>;
}

function Pct({ text }: { text: string }): ReactNode {
  return <span className={`f-pct ${text.startsWith("-") ? "neg" : "pos"}`}>{text}</span>;
}

function Arrow({ up }: { up: boolean }): ReactNode {
  return <span className={`f-arrow ${up ? "up" : "dn"}`}>{up ? "\u25B2" : "\u25BC"}</span>;
}

function Addr({ addr }: { addr: string }): ReactNode {
  return (
    <button className="f-addr" onClick={() => navigator.clipboard.writeText(addr)} title="Copy">
      {addr}
    </button>
  );
}

function Chain({ name }: { name: string }): ReactNode {
  return <span className="f-chain">{name}</span>;
}

function YN({ yes }: { yes: boolean }): ReactNode {
  return <span className={`f-yn ${yes ? "y" : "n"}`}>{yes ? "YES" : "NO"}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SCANNER — regex-based, finds earliest match, renders, continues
   ═══════════════════════════════════════════════════════════════════════════ */

function inl(text: string, _ctx: FormatContext): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    type C = { t: string; i: number; m: RegExpMatchArray };
    const cs: C[] = [];
    const add = (t: string, re: RegExp) => {
      const m = rest.match(re);
      if (m && m.index !== undefined) cs.push({ t, i: m.index, m });
    };

    add("val",   /\$[\d,]+\.?\d*/);
    add("pct",   /[+-]\d+\.?\d*%/);
    add("arrow", /[▲▼]/);
    add("addr",  /0x[a-fA-F0-9]{4,6}\.{2,3}[a-fA-F0-9]{3,4}/);
    // Match BOTH (chain) and [chain]
    add("chain", /[(\[]([\w-]+)[)\]]/);
    add("bold",  /\*\*([^*]+)\*\*/);
    add("yn",    /\b(YES|NO)\b/);

    if (!cs.length) { out.push(rest); break; }
    cs.sort((a, b) => a.i - b.i);
    const f = cs[0];
    const full = f.m[0];

    if (f.i > 0) out.push(rest.slice(0, f.i));

    switch (f.t) {
      case "val": out.push(<Val key={k++} text={full} />); break;
      case "pct": out.push(<Pct key={k++} text={full} />); break;
      case "arrow": out.push(<Arrow key={k++} up={full === "▲"} />); break;
      case "addr": out.push(<Addr key={k++} addr={full} />); break;
      case "chain": {
        const c = f.m[1];
        if (CHAINS.has(c)) out.push(<Chain key={k++} name={c} />);
        else out.push(full);
        break;
      }
      case "bold": out.push(<strong key={k++}>{f.m[1]}</strong>); break;
      case "yn": out.push(<YN key={k++} yes={full === "YES"} />); break;
    }
    rest = rest.slice(f.i + full.length);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STRUCTURED PARSERS — recognize specific command outputs and render cards
   ═══════════════════════════════════════════════════════════════════════════ */

/** Parse "  USDC: $320.35 (base)" into structured row */
function PositionRow({ line, ctx }: { line: string; ctx: FormatContext }): ReactNode {
  const m = line.trim().match(/^(.+?):\s*(\$[\d,.]+)\s*\((.+?)\)$/);
  if (!m) return <div className="f-row">{inl(line.trim(), ctx)}</div>;
  const [, asset, value, chain] = m;
  return (
    <div className="f-pos-row">
      <span className="f-pos-asset">{asset.trim()}</span>
      <span className="f-pos-val">{value}</span>
      <span className="f-pos-chain">{chain}</span>
    </div>
  );
}

/** Parse "  trade ETH $96.70 [ethereum] — 1d ago" into structured row */
function TxRow({ line, ctx }: { line: string; ctx: FormatContext }): ReactNode {
  const m = line.trim().match(/^(\w+)\s+(.+?)\s+(\$[\d,.]+)\s*[(\[]([\w-]+)[)\]]\s*—\s*(.+)$/);
  if (!m) return <div className="f-row">{inl(line.trim(), ctx)}</div>;
  const [, type, asset, value, chain, ago] = m;
  return (
    <div className="f-tx-row">
      <span className="f-tx-type">{type}</span>
      <span className="f-tx-asset">{asset.trim()}</span>
      <span className="f-pos-val">{value}</span>
      <span className="f-pos-chain">{chain}</span>
      <span className="f-tx-ago">{ago}</span>
    </div>
  );
}

/** Parse "  Supply: USDC — $5,500.00 [ethereum]" defi row */
function DefiRow({ line, ctx }: { line: string; ctx: FormatContext }): ReactNode {
  const m = line.trim().match(/^(.+?):\s*(.+?)\s*—\s*(\$[\d,.]+)\s*[(\[]([\w-]+)[)\]]$/);
  if (!m) return <div className="f-row">{inl(line.trim(), ctx)}</div>;
  const [, type, asset, value, chain] = m;
  return (
    <div className="f-pos-row">
      <span className="f-tx-type">{type.trim()}</span>
      <span className="f-pos-asset">{asset.trim()}</span>
      <span className="f-pos-val">{value}</span>
      <span className="f-pos-chain">{chain}</span>
    </div>
  );
}

/** Quick command — top positions as compact grid instead of flowing text */
function TopGrid({ line, ctx }: { line: string; ctx: FormatContext }): ReactNode {
  // "🏦 Top: USDC $5000.00, ETH $3500.00, DAI $2000.00"
  const content = line.replace(/^.*Top:\s*/, "");
  const items = content.split(",").map(s => s.trim()).filter(Boolean);
  // Only show first 6 in grid, rest as overflow
  const shown = items.slice(0, 6);
  const extra = items.length - 6;

  return (
    <div className="f-top-section">
      <div className="f-section-label">Top Holdings</div>
      <div className="f-top-grid">
        {shown.map((item, i) => {
          const m = item.match(/^(.+?)\s+(\$[\d,.]+)$/);
          if (!m) return <div key={i} className="f-top-item">{inl(item, ctx)}</div>;
          return (
            <div key={i} className="f-top-item">
              <span className="f-top-name">{m[1]}</span>
              <span className="f-pos-val">{m[2]}</span>
            </div>
          );
        })}
      </div>
      {extra > 0 && <div className="f-overflow">+{extra} more</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARD HEADER — clean command header with address
   ═══════════════════════════════════════════════════════════════════════════ */

function CardHeader({ emoji, label, rest, ctx }: {
  emoji: string; label: string; rest: string; ctx: FormatContext;
}): ReactNode {
  // Extract short address from rest
  const addrMatch = rest.match(/0x[a-fA-F0-9]{4,6}\.{2,3}[a-fA-F0-9]{3,4}/);
  const addrPart = addrMatch?.[0];
  // Get everything else (wallet name etc), clean parens
  const textPart = rest.replace(/0x[a-fA-F0-9]{4,6}\.{2,3}[a-fA-F0-9]{3,4}/g, "")
    .replace(/[()]/g, "").replace(/\s+/g, " ").trim();

  return (
    <div className="f-card-hdr">
      <span className="f-card-emoji">{emoji}</span>
      <div className="f-card-title">
        <span className="f-card-label">{label}</span>
        {textPart && <span className="f-card-name">{textPart}</span>}
        {addrPart && <Addr addr={addrPart} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION BAR
   ═══════════════════════════════════════════════════════════════════════════ */

const ACTIONS: Record<string, { label: string; cmd: string }[]> = {
  "\u{1F4CA}": [{ label: "Research", cmd: "/research" }, { label: "PnL", cmd: "/pnl" }],
  "\u{1F4B0}": [{ label: "Analyze", cmd: "/quick" }, { label: "History", cmd: "/history" }],
  "\u{1F4C8}": [{ label: "DeFi", cmd: "/defi" }],
  "\u{1F3D7}": [{ label: "PnL", cmd: "/pnl" }, { label: "NFTs", cmd: "/nft" }],
  "\u{1F4DC}": [{ label: "PnL", cmd: "/pnl" }, { label: "DeFi", cmd: "/defi" }],
  "\u{1F5BC}": [{ label: "Analyze", cmd: "/quick" }],
};

function ActionBar({ text, ctx }: { text: string; ctx: FormatContext }): ReactNode {
  if (!ctx.onCommand) return null;
  const first = text.split("\n")[0];
  const em = first.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]+)/u);
  const acts = em?.[1] ? ACTIONS[em[1]] : undefined;
  if (!acts?.length) return null;
  const addr = text.match(/0x[a-fA-F0-9]{4,6}\.{2,3}[a-fA-F0-9]{3,4}/)?.[0];

  return (
    <div className="f-actions">
      {acts.map(a => (
        <button key={a.cmd} className="f-act"
          onClick={() => ctx.onCommand!(`${a.cmd}${addr ? " " + addr : ""}`)}>
          {a.label} &rarr;
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT — the line-level classifier
   ═══════════════════════════════════════════════════════════════════════════ */

// Detect which command type this is from the first line
function detectType(text: string): string | null {
  const first = text.split("\n")[0];
  if (first.startsWith("💰 Wallet:")) return "balance";
  if (first.startsWith("📊")) return "quick";
  if (first.startsWith("📈")) return "pnl";
  if (first.startsWith("🏗")) return "defi";
  if (first.startsWith("📜")) return "history";
  if (first.startsWith("🖼")) return "nft";
  if (first.startsWith("⚔")) return "compare";
  return null;
}

// Is this a detail row with position data? "  USDC: $320 (base)"
function isPositionLine(line: string): boolean {
  return /^\s{2,}.+:\s*\$[\d,.]+\s*\(/.test(line);
}

// Is this a transaction line? "  trade ETH $96.70 [ethereum] — 1d ago"
function isTxLine(line: string): boolean {
  return /^\s{2,}\w+\s+.+\$[\d,.]+\s*[(\[]/.test(line);
}

// Is this a defi detail? "  Supply: USDC — $5,500 [ethereum]"
function isDefiLine(line: string): boolean {
  return /^\s{2,}.+:\s*.+—\s*\$[\d,.]+\s*[(\[]/.test(line);
}

export function formatMessage(text: string, ctx?: FormatContext): ReactNode {
  const c = ctx || {};
  if (!text) return null;

  const type = detectType(text);
  const lines = text.split("\n");
  const els: ReactNode[] = [];

  // Header emoji regex
  const HDR = /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2694}\u{FE0F}]+)\s*(\w[\w\s]*?):\s*(.+)/u;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Empty → spacer
    if (!line.trim()) { els.push(<div key={i} className="f-sp" />); continue; }

    // Box-drawing dividers
    if (/^[\u2500-\u257F]{3,}$/.test(line.trim())) { els.push(<div key={i} className="f-div" />); continue; }

    // Overflow hint
    if (line.trim().startsWith("... and ")) {
      els.push(<div key={i} className="f-overflow">{line.trim()}</div>);
      continue;
    }

    // Command header (first 3 lines)
    const hdr = line.match(HDR);
    if (hdr && i < 3) {
      els.push(<CardHeader key={i} emoji={hdr[1]} label={hdr[2].trim()} rest={hdr[3]} ctx={c} />);
      continue;
    }

    // Quick "Top:" line → render as grid
    if (type === "quick" && line.trim().startsWith("🏦 Top:")) {
      els.push(<TopGrid key={i} line={line} ctx={c} />);
      continue;
    }

    // Group header (▸)
    if (line.trim().startsWith("▸")) {
      els.push(<div key={i} className="f-group">{inl(line.trim().replace(/^▸\s*/, ""), c)}</div>);
      continue;
    }

    // Structured position row (balance, nft)
    if ((type === "balance" || type === "nft") && isPositionLine(raw)) {
      els.push(<PositionRow key={i} line={raw} ctx={c} />);
      continue;
    }

    // Transaction row (history)
    if (type === "history" && isTxLine(raw)) {
      els.push(<TxRow key={i} line={raw} ctx={c} />);
      continue;
    }

    // DeFi detail row
    if (type === "defi" && isDefiLine(raw)) {
      els.push(<DefiRow key={i} line={raw} ctx={c} />);
      continue;
    }

    // Generic indented detail
    if (/^\s{2,}/.test(raw) && line.trim().length > 0) {
      els.push(<div key={i} className="f-detail">{inl(line.trim(), c)}</div>);
      continue;
    }

    // Total row
    if (/^Total:/i.test(line.trim())) {
      els.push(<div key={i} className="f-total">{inl(line.trim(), c)}</div>);
      continue;
    }

    // Emoji-prefixed info line (💰 $824.40, 🔗 Chains:, ⏱ Frequency:)
    const emojiLine = line.trim().match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])\s*(.+)/u);
    if (emojiLine) {
      els.push(
        <div key={i} className="f-info">
          <span className="f-info-icon">{emojiLine[1]}</span>
          <span>{inl(emojiLine[2], c)}</span>
        </div>
      );
      continue;
    }

    // Section label (e.g. "Recent transactions:")
    if (line.trim().endsWith(":") && line.trim().length < 40) {
      els.push(<div key={i} className="f-section-label">{line.trim().slice(0, -1)}</div>);
      continue;
    }

    // Default text
    els.push(<div key={i} className="f-text">{inl(line.trim(), c)}</div>);
  }

  els.push(<ActionBar key="act" text={text} ctx={c} />);

  return <div className="f-msg">{els}</div>;
}
