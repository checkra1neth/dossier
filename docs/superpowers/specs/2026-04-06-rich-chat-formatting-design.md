# Rich Chat Formatting — Design Spec

## Goal

Transform plain-text chat responses into visually rich, interactive UI — without changing server code. A single frontend `formatMessage()` function parses existing text patterns and renders React components.

## Architecture

One file: `frontend/src/components/formatMessage.tsx`

- Exports `formatMessage(text: string, ctx?: FormatContext): ReactNode`
- ChatPanel calls it instead of raw `{msg.text}`
- Zero server changes — works with existing `*ToText()` output and XMTP DM text

```
FormatContext {
  onCommand?: (cmd: string) => void   // trigger a chat command from action buttons
}
```

## Line-Level Parser

Text split by `\n`. Each line classified by first match:

| Pattern | Component | Description |
|---------|-----------|-------------|
| Starts with emoji + command name (`📊 Quick:`) | `CommandHeader` | Large header with icon, address chip |
| `──────` (box-drawing chars) | `Divider` | Thin styled line |
| `▸ Name ($value)` | `GroupHeader` | Protocol/collection section header |
| 2+ space indent (`  Supply:`, `  Trade ETH`) | `DetailRow` | Nested item with inline formatting |
| `Total:` or `💰 Total` | `TotalRow` | Bold summary row |
| `... and N more` | `OverflowHint` | Muted overflow indicator |
| Everything else | `TextLine` | Paragraph with inline formatting |

## Inline Formatter

Regex scanner within each line. Finds earliest match, renders component, continues:

| Pattern | Component | Interactive |
|---------|-----------|-------------|
| `$1,234.56` (dollar + digits) | `ValueBadge` — green-tinted bg, bold | No |
| `+5.2%` / `-3.1%` (signed percent) | `PercentBadge` — green/red pill | No |
| `▲` / `▼` | Colored arrow icon | No |
| `0x[a-f0-9]{4}...[a-f0-9]{4}` | `AddressChip` — mono font, pill | Click = copy to clipboard |
| `[ethereum]`, `[base]`, `[polygon]` etc | `ChainBadge` — subtle pill | No |
| Known token symbols (USDC, ETH, DAI, etc) | `TokenChip` — pill | Click = run `/quick` for token |
| `**text**` | `<strong>` | No |
| `YES` / `NO` (standalone) | Green/red badge | No |

Token detection: match uppercase 2-6 char words that appear after `:` or at line start, filtered against a known token list to avoid false positives.

## Action Bar

Below each agent message, contextual action buttons based on command type (detected by first emoji):

| Emoji | Command | Actions |
|-------|---------|---------|
| `📊` | /quick | "Research deeper" → `/research`, "Check PnL" → `/pnl` |
| `💰` | /balance | "Quick analysis" → `/quick`, "History" → `/history` |
| `📈` | /pnl | "DeFi positions" → `/defi`, "Compare" → `/compare` |
| `🏗` | /defi | "PnL report" → `/pnl`, "NFTs" → `/nft` |
| `📜` | /history | "PnL report" → `/pnl`, "DeFi" → `/defi` |
| `🖼` | /nft | "Quick analysis" → `/quick` |
| `⚔️` | /compare | — |
| Other | — | "Copy" only |

Actions extract the address from the message header and inject it into the command.

## Visual Style (Dossier Light Theme)

All colors use oklch for perceptual uniformity:

- **ValueBadge:** `oklch(94% 0.03 145)` bg, `oklch(30% 0.1 145)` text, 600 weight
- **PercentBadge positive:** `oklch(92% 0.06 145)` bg, dark green text
- **PercentBadge negative:** `oklch(93% 0.05 25)` bg, dark red text
- **AddressChip:** `var(--sand-1)` bg, mono font, hover border accent
- **ChainBadge:** `var(--sand-1)` bg, `var(--sand-2)` border, 0.65rem
- **TokenChip:** `var(--sand-0)` bg, `var(--accent)` left border, 0.7rem mono
- **GroupHeader:** `var(--sand-1)` bg, 12px radius, bold, clickable
- **CommandHeader:** 1rem display font, emoji 1.2rem, address chip inline
- **Divider:** 1px `var(--sand-2)`, 8px vertical margin
- **TotalRow:** 600 weight, slightly larger font
- **ActionBar:** ghost buttons, `var(--sand-2)` border, 0.68rem, hover → `var(--sand-1)` bg
- **OverflowHint:** `var(--ink-muted)`, italic, 0.72rem

## File Structure

```
frontend/src/components/
  formatMessage.tsx    — parser + all micro-components (single file)
  ChatPanel.tsx        — updated to use formatMessage()
```

CSS additions go into existing `dashboard.css`.

## Scope

- No server changes
- No new dependencies
- Single new file + CSS additions + ChatPanel update
- Works with all 7 existing commands
- Graceful fallback: unrecognized text renders as plain text
