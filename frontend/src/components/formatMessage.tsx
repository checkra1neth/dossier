import React from "react";
import type { ReactNode } from "react";

export interface FormatContext {
  onCommand?: (cmd: string) => void;
}

const KNOWN_TOKENS = new Set([
  "ETH","WETH","BTC","WBTC","USDC","USDT","DAI","LINK","UNI","AAVE",
  "COMP","MKR","SNX","CRV","BAL","SUSHI","YFI","MATIC","ARB","OP",
  "BASE","DEGEN","BRETT","TOSHI","L3","PEPE","SHIB","APE",
]);

const CHAINS = new Set([
  "ethereum","base","polygon","arbitrum","optimism","avalanche",
  "binance-smart-chain","fantom","gnosis","zksync","linea","scroll",
]);

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

export function formatMessage(text: string, ctx?: FormatContext): ReactNode {
  const context = ctx || {};
  if (!text) return null;

  const lines = text.split("\n");
  const elements: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    if (!trimmed) {
      elements.push(<div key={i} className="fmt-spacer" />);
      continue;
    }

    if (/^[\u2500-\u257F]{3,}$/.test(trimmed)) {
      elements.push(<Divider key={i} />);
      continue;
    }

    if (trimmed.trimStart().startsWith("... and ")) {
      elements.push(<OverflowHint key={i} text={trimmed.trimStart()} />);
      continue;
    }

    if (trimmed.startsWith("▸")) {
      elements.push(<GroupHeader key={i} text={trimmed} ctx={context} />);
      continue;
    }

    if (/^\s{2,}/.test(line) && trimmed.length > 0) {
      elements.push(<DetailRow key={i} text={trimmed} ctx={context} />);
      continue;
    }

    if (/^(Total:|💰\s*Total)/i.test(trimmed)) {
      elements.push(<TotalRow key={i} text={trimmed} ctx={context} />);
      continue;
    }

    const cmdMatch = trimmed.match(CMD_EMOJI);
    if (cmdMatch && i < 3) {
      elements.push(<CommandHeader key={i} emoji={cmdMatch[1]} text={cmdMatch[2]} ctx={context} />);
      continue;
    }

    elements.push(<TextLine key={i} text={trimmed} ctx={context} />);
  }

  elements.push(<ActionBar key="actions" text={text} ctx={context} />);

  return <div className="fmt-msg">{elements}</div>;
}
