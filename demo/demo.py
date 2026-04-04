#!/usr/bin/env python3
"""
OWS Intelligence Wire — Hackathon Demo Script
Simulates the CLI client interaction for asciinema recording.
"""
import sys
import time
import random

# Colors
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
CYAN = "\033[36m"
RED = "\033[31m"
MAGENTA = "\033[35m"
WHITE = "\033[97m"
BG_DARK = "\033[48;5;235m"

def type_text(text: str, speed: float = 0.04):
    """Simulate human typing."""
    for ch in text:
        sys.stdout.write(ch)
        sys.stdout.flush()
        jitter = random.uniform(speed * 0.3, speed * 1.8)
        time.sleep(jitter)
    sys.stdout.write("\n")
    sys.stdout.flush()

def instant(text: str, delay: float = 0.0):
    """Print instantly with optional delay after."""
    print(text)
    if delay > 0:
        time.sleep(delay)

def prompt_and_type(cmd: str, think: float = 0.8):
    """Show prompt, pause, then type command."""
    sys.stdout.write(f"{GREEN}you>{RESET} ")
    sys.stdout.flush()
    time.sleep(think)
    type_text(cmd)

def separator():
    instant(f"{DIM}{'-' * 50}{RESET}")

def banner():
    instant("")
    instant(f"{BOLD}{CYAN}  ╔══════════════════════════════════════════╗{RESET}", 0.05)
    instant(f"{BOLD}{CYAN}  ║   OWS Intelligence Wire — Demo          ║{RESET}", 0.05)
    instant(f"{BOLD}{CYAN}  ║   DeFi AI Agent • 14 Commands           ║{RESET}", 0.05)
    instant(f"{BOLD}{CYAN}  ║   XMTP Chat • x402 USDC Payments        ║{RESET}", 0.05)
    instant(f"{BOLD}{CYAN}  ╚══════════════════════════════════════════╝{RESET}", 0.3)
    instant("")

# ─── SCENE 1: Startup ───────────────────────────────────────────────

banner()

instant(f"{DIM}$ npm run client{RESET}", 1.0)
instant("")
instant(f"{YELLOW}🔑 OWS Wallet: client-researcher{RESET}", 0.3)
instant(f"{YELLOW}📍 Address: 0x1582c2d401B5956853b2992dfeDDC630e031781f{RESET}", 0.5)
instant("")
instant(f"{DIM}⏳ Connecting to XMTP (dev)...{RESET}", 1.5)
instant(f"{GREEN}✅ XMTP connected: 0x1582c2d401B5956853b2992dfeDDC630e031781f{RESET}", 0.3)
instant("")
instant(f"{BLUE}📨 Opening DM with research agent: 0x379cf10f35950dDc581940EDD4dCBD16Dd226518{RESET}", 1.0)
instant(f"{GREEN}✅ DM created{RESET}", 0.5)
instant("")
instant(f"{BOLD}🎯 Dossier. Commands:{RESET}", 0.2)
instant("")
instant(f" {CYAN}📊 Analytics:{RESET}")
instant(f"   /quick 0x<addr>          — portfolio snapshot ($0.01)")
instant(f"   /research 0x<addr>       — deep research ($0.05)")
instant(f"   /pnl 0x<addr>            — profit & loss ($0.02)")
instant(f"   /defi 0x<addr>           — DeFi positions ($0.02)")
instant(f"   /history 0x<addr>        — tx history ($0.02)")
instant(f"   /nft 0x<addr>            — NFT portfolio ($0.02)")
instant(f"   /compare 0x<a> 0x<b>     — compare wallets ($0.05)")
instant(f" {CYAN}💰 Wallet:{RESET}")
instant(f"   /balance                 — your wallet balance (free)")
instant(f"   /send <amt> <tok> to <addr> — send tokens ($0.01)")
instant(f"   /swap <amt> <tok> to <tok>  — swap tokens ($0.01)")
instant(f"   /bridge <amt> <tok> from <chain> to <chain> ($0.01)")
instant(f" {CYAN}👁️ Monitoring:{RESET}")
instant(f"   /watch 0x<addr>          — watch wallet activity ($0.10)")
instant(f"   /unwatch 0x<addr>        — stop watching (free)", 1.0)
instant("")

# ─── SCENE 2: /balance (free command) ──────────────────────────────

prompt_and_type("/balance")
instant(f"{BLUE}📤 Sent: /balance{RESET}", 2.0)
instant("")
instant(f"{MAGENTA}📩 Agent:{RESET}")
separator()
instant(f"{BOLD}💰 Wallet Balance{RESET}")
instant(f"   Address: 0x1582...781f")
instant(f"   Chain:   Base (8453)")
instant("")
instant(f"   {GREEN}USDC    $142.37{RESET}")
instant(f"   {GREEN}ETH     $89.12  (0.0281 ETH){RESET}")
instant(f"   {GREEN}DEGEN   $23.50  (47,000 DEGEN){RESET}")
instant(f"   {DIM}────────────────────{RESET}")
instant(f"   {BOLD}Total:  $254.99{RESET}")
separator()
time.sleep(1.5)
instant("")

# ─── SCENE 3: /quick (portfolio snapshot, paid) ───────────────────

prompt_and_type("/quick 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", think=0.5)
instant(f"{BLUE}📤 Sent: /quick 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045{RESET}", 0.5)
instant("")
instant(f"{YELLOW}💳 Payment request received!{RESET}", 0.8)
instant(f"   Chain: Base (8453)")
instant(f"   Pay $0.01 USDC for portfolio snapshot")
instant(f"   {DIM}EIP-3009 TransferWithAuthorization (gasless){RESET}")
instant("")
instant(f"   Type {BOLD}\"pay\"{RESET} to approve, or {BOLD}\"skip\"{RESET} to cancel.", 1.2)
instant("")

prompt_and_type("pay", think=0.6)
instant("")
instant(f"{YELLOW}🔐 Executing x402 payment via OWS...{RESET}", 0.5)
instant(f"   Wallet: client-researcher")
instant(f"   EIP-3009 TransferWithAuthorization (gasless)", 1.5)
instant(f"{GREEN}✅ Paid $0.01 USDC → 0x379c...6518{RESET}", 0.8)
instant("")
instant(f"{MAGENTA}📩 Agent:{RESET}")
separator()
instant(f"{BOLD}📊 QUICK SNAPSHOT: vitalik.eth{RESET}")
instant(f"   0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
instant("")
instant(f"   💰 Total Value:  {GREEN}$784,231,402.18{RESET}")
instant(f"   🔗 Chains:       7 (Ethereum, Arbitrum, Optimism, Base, Polygon, zkSync, Scroll)")
instant(f"   🪙 Tokens:       142")
instant(f"   🧠 Smart Money:  {GREEN}YES{RESET}")
instant("")
instant(f"   {BOLD}Top Holdings:{RESET}")
instant(f"     ETH          $761,208,500 (97.1%)")
instant(f"     USDC         $12,481,200  (1.6%)")
instant(f"     ENS          $4,892,100   (0.6%)")
instant(f"     RPL          $2,103,400   (0.3%)")
instant(f"     EIGEN        $1,891,200   (0.2%)")
separator()
time.sleep(2.0)
instant("")

# ─── SCENE 4: /research (deep research, x402 paid) ───────────────

prompt_and_type("/research 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", think=0.5)
instant(f"{BLUE}📤 Sent: /research 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045{RESET}", 0.5)
instant("")
instant(f"{YELLOW}💳 Payment request received!{RESET}", 0.8)
instant(f"   Chain: Base (8453)")
instant(f"   Pay $0.05 USDC for deep wallet research")
instant(f"   {DIM}EIP-3009 TransferWithAuthorization (gasless){RESET}")
instant("")
instant(f"   Type {BOLD}\"pay\"{RESET} to approve, or {BOLD}\"skip\"{RESET} to cancel.", 1.0)
instant("")

prompt_and_type("pay", think=0.4)
instant("")
instant(f"{YELLOW}🔐 Executing x402 payment via OWS...{RESET}", 0.5)
instant(f"   Wallet: client-researcher")
instant(f"   EIP-3009 TransferWithAuthorization (gasless)")
instant(f"{DIM}⏳ Signing payment & waiting for research report...{RESET}")

# Simulate processing stages
time.sleep(1.0)
instant(f"   {DIM}[1/4] Fetching portfolio data from Zerion...{RESET}", 1.2)
instant(f"   {DIM}[2/4] Analyzing DeFi positions...{RESET}", 1.0)
instant(f"   {DIM}[3/4] Computing PnL & transaction patterns...{RESET}", 1.5)
instant(f"   {DIM}[4/4] LLM analysis via OpenRouter...{RESET}", 2.0)
instant("")
instant(f"{GREEN}✅ Paid $0.05 USDC → 0x379c...6518{RESET}", 0.3)
instant(f"{GREEN}✅ Research report received!{RESET}", 0.5)
instant("")
instant(f"{MAGENTA}📩 Agent:{RESET}")
separator()
instant(f"""{BOLD}{CYAN}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 DEEP RESEARCH REPORT: vitalik.eth
  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}""", 0.3)
instant("")
instant(f"  {BOLD}💰 PORTFOLIO OVERVIEW{RESET}")
instant(f"  Total Value:    {GREEN}$784,231,402.18{RESET}")
instant(f"  Active Chains:  7")
instant(f"  Token Count:    142")
instant(f"  NFT Count:      1,847")
instant(f"  Smart Money:    {GREEN}YES ✓{RESET}")
instant("")
instant(f"  {BOLD}🏦 TOP POSITIONS{RESET}")
instant(f"  ┌──────────────┬────────────────┬───────┐")
instant(f"  │ Asset        │ Value          │ %     │")
instant(f"  ├──────────────┼────────────────┼───────┤")
instant(f"  │ ETH          │ $761,208,500   │ 97.1% │")
instant(f"  │ USDC         │ $12,481,200    │ 1.6%  │")
instant(f"  │ ENS          │ $4,892,100     │ 0.6%  │")
instant(f"  │ RPL          │ $2,103,400     │ 0.3%  │")
instant(f"  │ EIGEN        │ $1,891,200     │ 0.2%  │")
instant(f"  └──────────────┴────────────────┴───────┘")
instant("")
instant(f"  {BOLD}🏗️ DEFI POSITIONS{RESET}")
instant(f"  Aave V3:      $3.2M supplied (ETH, USDC)")
instant(f"  Lido:         218,400 stETH ($691M)")
instant(f"  EigenLayer:   Restaking active")
instant(f"  Uniswap V3:   ETH/USDC LP ($892K)")
instant("")
instant(f"  {BOLD}📈 PNL (30 days){RESET}")
instant(f"  Realized:     {GREEN}+$12,481,200{RESET}")
instant(f"  Unrealized:   {GREEN}+$89,210,400{RESET}")
instant(f"  ROI:          {GREEN}+14.2%{RESET}")
instant("")
instant(f"  {BOLD}🔍 TRANSACTION PATTERNS{RESET}")
instant(f"  Last 30 days: 847 transactions")
instant(f"  Most active:  Ethereum mainnet (612)")
instant(f"  Top protocol: Aave V3 (198 interactions)")
instant(f"  Gas spent:    $42,180")
instant("")
instant(f"  {BOLD}🧠 AI ANALYSIS{RESET}")
instant(f"""  {WHITE}This is one of the most prominent Ethereum wallets,
  belonging to Vitalik Buterin. The portfolio is heavily
  concentrated in ETH (97.1%), reflecting a long-term
  conviction position. Active DeFi participation through
  Aave, Lido staking, and EigenLayer restaking suggests
  alignment with Ethereum's roadmap. Recent transaction
  patterns show increased activity in L2 ecosystems
  (Base, Arbitrum, Optimism) and grants/donations via
  Gitcoin. Risk level is LOW given the portfolio size
  and diversification across major protocols.{RESET}""")
instant("")
instant(f"  {BOLD}⚠️  Risk Level: {GREEN}LOW{RESET}")
instant(f"  {BOLD}🏁 Verdict: {CYAN}Long-term ETH maximalist with active DeFi participation{RESET}")
instant(f"""
{CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}""")
separator()
time.sleep(2.5)
instant("")

# ─── SCENE 5: /swap (wallet action) ───────────────────────────────

prompt_and_type("/swap 10 USDC to ETH", think=0.6)
instant(f"{BLUE}📤 Sent: /swap 10 USDC to ETH{RESET}", 0.5)
instant("")
instant(f"{YELLOW}💳 Payment request received!{RESET}", 0.8)
instant(f"   Chain: Base (8453)")
instant(f"   Pay $0.01 USDC for DEX swap")
instant("")
instant(f"   Type {BOLD}\"pay\"{RESET} to approve, or {BOLD}\"skip\"{RESET} to cancel.", 1.0)
instant("")

prompt_and_type("pay", think=0.5)
instant("")
instant(f"{YELLOW}🔐 Executing x402 payment via OWS...{RESET}", 0.5)
instant(f"{GREEN}✅ Paid $0.01 USDC{RESET}", 1.5)
instant("")
instant(f"{MAGENTA}📩 Agent:{RESET}")
separator()
instant(f"{BOLD}🔄 SWAP EXECUTED{RESET}")
instant(f"   10 USDC → 0.00315 ETH")
instant(f"   Rate: 1 ETH = $3,174.60")
instant(f"   Route: USDC → ETH via Uniswap V3 (Base)")
instant(f"   Slippage: 0.12%")
instant(f"   Tx: {BLUE}0x7a8f...3c21{RESET}")
separator()
time.sleep(2.0)
instant("")

# ─── SCENE 6: /watch (monitoring) ─────────────────────────────────

prompt_and_type("/watch 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", think=0.5)
instant(f"{BLUE}📤 Sent: /watch 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045{RESET}", 0.5)
instant("")
instant(f"{YELLOW}💳 Payment request received!{RESET}", 0.8)
instant(f"   Chain: Base (8453)")
instant(f"   Pay $0.10 USDC for wallet monitoring")
instant("")
instant(f"   Type {BOLD}\"pay\"{RESET} to approve, or {BOLD}\"skip\"{RESET} to cancel.", 1.0)
instant("")

prompt_and_type("pay", think=0.4)
instant("")
instant(f"{GREEN}✅ Paid $0.10 USDC{RESET}", 1.2)
instant("")
instant(f"{MAGENTA}📩 Agent:{RESET}")
separator()
instant(f"{BOLD}👁️ WATCHING: vitalik.eth{RESET}")
instant(f"   0xd8dA...6045")
instant(f"   You'll receive XMTP alerts for:")
instant(f"   • Large transfers (> $10,000)")
instant(f"   • DeFi interactions")
instant(f"   • NFT mints/transfers")
instant(f"   • Contract deployments")
instant(f"   Duration: 24 hours")
instant(f"   /unwatch to stop")
separator()
time.sleep(2.0)
instant("")

# ─── OUTRO ─────────────────────────────────────────────────────────

prompt_and_type("quit", think=1.0)
instant(f"{YELLOW}👋 Bye!{RESET}", 0.5)
instant("")
instant(f"{BOLD}{CYAN}  ╔══════════════════════════════════════════╗{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║  OWS Intelligence Wire                  ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║  Pay-per-call DeFi AI Agent             ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║                                          ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║  ⚡ 14 commands • XMTP chat • x402 USDC ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║  🔐 OWS wallet • EIP-3009 gasless       ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║  🧠 AI analysis via OpenRouter           ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ║  📊 Zerion API data • Base mainnet       ║{RESET}", 0.05)
instant(f"{BOLD}{CYAN}  ╚══════════════════════════════════════════╝{RESET}", 0.5)
instant("")
