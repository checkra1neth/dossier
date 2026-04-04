import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode, FormEvent } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "../styles/dashboard.css";
import { COMMANDS, query, queryGet } from "../api";
import type { Command } from "../api";
import { ReportView } from "../components/reports";
import { useBridge } from "../hooks/useBridge";
import { ChatPanel } from "../components/ChatPanel";

interface HistoryEntry {
  command: Command;
  address: string;
  timestamp: number;
  success: boolean;
}

const CHAIN_OPTIONS = ["base", "ethereum", "arbitrum", "optimism", "polygon", "avalanche", "bsc"];

const CMD_CATEGORIES: { label: string; cmds: { cmd: Command; desc: string }[] }[] = [
  {
    label: "Analytics",
    cmds: [
      { cmd: "quick", desc: "Portfolio snapshot" },
      { cmd: "research", desc: "Deep AI report" },
      { cmd: "pnl", desc: "Profit & loss" },
      { cmd: "defi", desc: "DeFi positions" },
      { cmd: "history", desc: "Transactions" },
      { cmd: "nft", desc: "NFT holdings" },
      { cmd: "compare", desc: "Compare wallets" },
    ],
  },
  {
    label: "Wallet",
    cmds: [
      { cmd: "balance", desc: "Token balances" },
      { cmd: "swap", desc: "Swap tokens" },
      { cmd: "bridge", desc: "Bridge cross-chain" },
      { cmd: "send", desc: "Send tokens" },
    ],
  },
  {
    label: "Monitor",
    cmds: [
      { cmd: "watch", desc: "Watch wallet" },
      { cmd: "unwatch", desc: "Stop watching" },
    ],
  },
];

const ADDRESS_CMDS: Command[] = ["quick", "research", "pnl", "defi", "history", "nft", "watch", "unwatch"];

const LOADING_STEPS: Record<string, string[]> = {
  research: ["Fetching portfolio...", "Analyzing positions...", "Running AI analysis...", "Generating report..."],
  quick: ["Fetching portfolio...", "Loading positions..."],
  pnl: ["Fetching profit & loss data...", "Calculating ROI..."],
  defi: ["Scanning DeFi protocols...", "Loading positions..."],
  history: ["Loading transactions...", "Analyzing patterns..."],
  nft: ["Scanning NFT collections...", "Fetching floor prices..."],
  compare: ["Fetching wallet A...", "Fetching wallet B...", "Comparing..."],
  balance: ["Loading balances..."],
  swap: ["Resolving tokens...", "Fetching best route..."],
  bridge: ["Finding bridge routes...", "Estimating gas..."],
  send: ["Preparing transaction..."],
  watch: ["Setting up monitoring..."],
  unwatch: ["Removing monitor..."],
};

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

function cmdPrice(cmd: Command): string {
  return COMMANDS.find((c) => c.cmd === cmd)?.price ?? "";
}

export function Dashboard(): ReactNode {
  const [activeCmd, setActiveCmd] = useState<Command>("quick");
  const [input, setInput] = useState("");
  const [inputB, setInputB] = useState("");
  const [amount, setAmount] = useState("");
  const [inputToken, setInputToken] = useState("");
  const [outputToken, setOutputToken] = useState("");
  const [symbol, setSymbol] = useState("");
  const [chain, setChain] = useState("base");
  const [fromChain, setFromChain] = useState("base");
  const [toChain, setToChain] = useState("ethereum");
  const [toAddress, setToAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<unknown>(null);
  const [reportCmd, setReportCmd] = useState<Command | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const bridge = useBridge();
  const [showBridge, setShowBridge] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, [activeCmd]);

  const handleCmdChange = useCallback((cmd: Command) => {
    if (reportRef.current && reportData) {
      gsap.to(reportRef.current, {
        autoAlpha: 0, y: -10, duration: 0.2, ease: "power2.in",
        onComplete: () => { setActiveCmd(cmd); setReportData(null); setReportCmd(null); setError(null); },
      });
    } else {
      setActiveCmd(cmd); setReportData(null); setReportCmd(null); setError(null);
    }
  }, [reportData]);

  const canSubmit = useCallback((): boolean => {
    if (loading) return false;
    if (ADDRESS_CMDS.includes(activeCmd)) return !!input.trim();
    if (activeCmd === "balance") return true;
    if (activeCmd === "compare") return !!input.trim() && !!inputB.trim();
    if (activeCmd === "swap") return !!amount.trim() && !!inputToken.trim() && !!outputToken.trim();
    if (activeCmd === "bridge") return !!amount.trim() && !!symbol.trim();
    if (activeCmd === "send") return !!amount.trim() && !!symbol.trim() && !!toAddress.trim();
    return false;
  }, [loading, activeCmd, input, inputB, amount, inputToken, outputToken, symbol, toAddress]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setLoading(true); setError(null); setLoadingStep(0);

    if (reportRef.current) gsap.to(reportRef.current, { autoAlpha: 0, y: -10, duration: 0.15, ease: "power2.in" });

    const steps = LOADING_STEPS[activeCmd] ?? ["Processing..."];
    if (steps.length > 1) {
      let step = 0;
      loadingIntervalRef.current = setInterval(() => { step = Math.min(step + 1, steps.length - 1); setLoadingStep(step); }, 1500);
    }

    const label = input.trim() || amount.trim() || "action";
    try {
      let data: unknown;
      if (activeCmd === "balance") {
        data = await query<unknown>(activeCmd, { address: input.trim() });
      } else if (activeCmd === "compare") {
        data = await query<unknown>(activeCmd, { addressA: input.trim(), addressB: inputB.trim() });
      } else if (activeCmd === "swap") {
        data = await query<unknown>(activeCmd, { amount: parseFloat(amount.trim()), inputToken: inputToken.trim(), outputToken: outputToken.trim(), chain });
      } else if (activeCmd === "bridge") {
        data = await query<unknown>(activeCmd, { amount: parseFloat(amount.trim()), symbol: symbol.trim(), fromChain, toChain });
      } else if (activeCmd === "send") {
        data = await query<unknown>(activeCmd, { amount: parseFloat(amount.trim()), symbol: symbol.trim(), toAddress: toAddress.trim(), chain });
      } else {
        data = await query<unknown>(activeCmd, { address: input.trim() });
      }
      setReportData(data); setReportCmd(activeCmd);
      setHistory((prev) => [{ command: activeCmd, address: label, timestamp: Date.now(), success: true }, ...prev.slice(0, 19)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setHistory((prev) => [{ command: activeCmd, address: label, timestamp: Date.now(), success: false }, ...prev.slice(0, 19)]);
    } finally {
      setLoading(false); setLoadingStep(0);
      if (loadingIntervalRef.current) { clearInterval(loadingIntervalRef.current); loadingIntervalRef.current = null; }
    }
  }, [activeCmd, input, inputB, amount, inputToken, outputToken, symbol, chain, fromChain, toChain, toAddress, canSubmit]);

  useGSAP(() => {
    if (reportRef.current && reportData) {
      gsap.fromTo(reportRef.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" });
    }
  }, { dependencies: [reportData, reportCmd], scope: reportRef });

  const renderForm = (): ReactNode => {
    if (activeCmd === "balance") {
      return (
        <div className="d-input-row">
          <input ref={inputRef} className="d-input" type="text" placeholder="Wallet address or name (optional)" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="d-btn" type="submit" disabled={!canSubmit()}>{loading ? "Loading..." : "Check"}</button>
        </div>
      );
    }
    if (activeCmd === "compare") {
      return (
        <div className="d-input-row">
          <input ref={inputRef} className="d-input" type="text" placeholder="Wallet A (0x...)" value={input} onChange={(e) => setInput(e.target.value)} />
          <input className="d-input" type="text" placeholder="Wallet B (0x...)" value={inputB} onChange={(e) => setInputB(e.target.value)} />
          <button className="d-btn" type="submit" disabled={!canSubmit()}>{loading ? "Analyzing..." : "Compare"}</button>
        </div>
      );
    }
    if (activeCmd === "swap") {
      return (
        <div className="d-form-grid">
          <div className="d-field"><label>Amount</label><input ref={inputRef} type="text" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="d-field"><label>From</label><input type="text" placeholder="USDC" value={inputToken} onChange={(e) => setInputToken(e.target.value)} /></div>
          <div className="d-field"><label>To</label><input type="text" placeholder="ETH" value={outputToken} onChange={(e) => setOutputToken(e.target.value)} /></div>
          <div className="d-field"><label>Chain</label><select value={chain} onChange={(e) => setChain(e.target.value)}>{CHAIN_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <button className="d-btn d-btn-grid" type="submit" disabled={!canSubmit()}>{loading ? "Processing..." : "Swap"}</button>
        </div>
      );
    }
    if (activeCmd === "bridge") {
      return (
        <div className="d-form-grid">
          <div className="d-field"><label>Amount</label><input ref={inputRef} type="text" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="d-field"><label>Token</label><input type="text" placeholder="USDC" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          <div className="d-field"><label>From</label><select value={fromChain} onChange={(e) => setFromChain(e.target.value)}>{CHAIN_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="d-field"><label>To</label><select value={toChain} onChange={(e) => setToChain(e.target.value)}>{CHAIN_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <button className="d-btn d-btn-grid" type="submit" disabled={!canSubmit()}>{loading ? "Processing..." : "Bridge"}</button>
        </div>
      );
    }
    if (activeCmd === "send") {
      return (
        <div className="d-form-grid">
          <div className="d-field"><label>Amount</label><input ref={inputRef} type="text" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="d-field"><label>Token</label><input type="text" placeholder="USDC" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          <div className="d-field"><label>To</label><input type="text" placeholder="0x..." value={toAddress} onChange={(e) => setToAddress(e.target.value)} /></div>
          <div className="d-field"><label>Chain</label><select value={chain} onChange={(e) => setChain(e.target.value)}>{CHAIN_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <button className="d-btn d-btn-grid" type="submit" disabled={!canSubmit()}>{loading ? "Processing..." : "Send"}</button>
        </div>
      );
    }
    // Default: address input
    return (
      <div className="d-input-row">
        <input ref={inputRef} className="d-input" type="text" placeholder="Enter wallet address (0x...)" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="d-btn" type="submit" disabled={!canSubmit()}>{loading ? "Processing..." : "Analyze"}</button>
      </div>
    );
  };

  const loadingSteps = LOADING_STEPS[activeCmd] ?? ["Processing..."];
  const price = cmdPrice(activeCmd);

  return (
    <>
      <header className="d-topbar">
        <Link to="/" className="d-logo">Dossier</Link>
        <div className="d-wallet-area">
          {bridge.status === "connected" && bridge.address ? (
            <button className="d-wallet-btn connected" onClick={() => setShowBridge(!showBridge)} type="button">
              <span className="d-wallet-dot" />
              <span className="d-wallet-label">OWS</span>
              {bridge.address.slice(0, 6)}...{bridge.address.slice(-4)}
            </button>
          ) : (
            <button className="d-wallet-btn" onClick={() => setShowBridge(!showBridge)} type="button">
              {bridge.status === "waiting" ? "Connect OWS Wallet" : "Reconnecting..."}
            </button>
          )}
          {showBridge && (
            <div className="d-wallet-dropdown">
              {bridge.status === "connected" && bridge.address ? (
                <div className="d-wallet-info">
                  <div className="d-wi-row"><span>Wallet</span><strong>{bridge.name}</strong></div>
                  <div className="d-wi-row"><span>Address</span><span className="mono">{bridge.address}</span></div>
                  <div className="d-wi-row"><span>Status</span><span className="d-bridge-ok">Connected via bridge</span></div>
                </div>
              ) : (
                <div className="d-bridge-pair">
                  <p className="d-bridge-label">Run in your terminal:</p>
                  <button
                    className="d-bridge-cmd"
                    onClick={() => navigator.clipboard.writeText(bridge.connectCommand)}
                    type="button"
                    title="Click to copy"
                  >
                    {bridge.connectCommand}
                  </button>
                  <p className="d-bridge-wait">Waiting for connection...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="d-hero">
        <h1 className="d-title">Wallet Intelligence</h1>
        <p className="d-subtitle">Select a command, enter a wallet address, get results. Paid via x402 USDC on Base through your OWS wallet.</p>

        {/* Command selector */}
        <div className="d-cats">
          {CMD_CATEGORIES.map((cat) => (
            <div className="d-cat" key={cat.label}>
              <div className="d-cat-label">{cat.label}</div>
              <div className="d-cat-cmds">
                {cat.cmds.map((c) => (
                  <button
                    key={c.cmd}
                    className={`d-cmd${activeCmd === c.cmd ? " active" : ""}`}
                    onClick={() => handleCmdChange(c.cmd)}
                    type="button"
                  >
                    <span className="d-cmd-name">/{c.cmd}</span>
                    <span className="d-cmd-desc">{c.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form className="d-form" onSubmit={handleSubmit}>
          {renderForm()}
          {price && <div className="d-price">Cost: {price} USDC per call</div>}
        </form>
      </div>

      <div className="d-content">
        {error && (
          <div className="d-error">
            <span>{error}</span>
            <button onClick={() => setError(null)} type="button">Dismiss</button>
          </div>
        )}

        {loading && (
          <div className="d-loading">
            <div className="d-skel-stats">
              {[1, 2, 3, 4].map((i) => <div key={i} className="skel skel-block" />)}
            </div>
            <div className="d-skel-body">
              <div className="skel skel-line" />
              <div className="skel skel-line short" />
              <div className="skel skel-line" />
            </div>
            <p className="d-loading-msg">{loadingSteps[loadingStep]}</p>
          </div>
        )}

        {!loading && reportData != null && reportCmd != null && (
          <div ref={reportRef} style={{ visibility: "hidden" }}>
            <ReportView command={reportCmd} data={reportData} />
          </div>
        )}

        {!loading && !reportData && !error && (
          <div className="d-empty">
            <div className="d-empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="23" stroke="var(--sand-3)" strokeWidth="1.5" />
                <path d="M16 24h16M24 16v16" stroke="var(--sand-3)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p>Select a command and enter a wallet address to begin.</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="d-history">
            <h3>Recent queries</h3>
            <div className="d-history-list">
              {history.map((entry, i) => (
                <div key={`${entry.timestamp}-${i}`} className="d-history-item">
                  <span className="d-h-cmd">/{entry.command}</span>
                  <span className="d-h-addr">{shortAddr(entry.address)}</span>
                  <span className="d-h-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className={`d-h-status ${entry.success ? "ok" : "fail"}`}>{entry.success ? "OK" : "FAIL"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showChat ? (
        <ChatPanel bridge={bridge} />
      ) : (
        <button className="chat-toggle" onClick={() => setShowChat(true)} type="button" title="Open XMTP Chat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
    </>
  );
}
