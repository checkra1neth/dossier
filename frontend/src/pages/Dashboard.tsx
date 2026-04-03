import { useState, useCallback } from "react";
import type { ReactNode, FormEvent } from "react";
import { Link } from "react-router-dom";
import "../styles/dashboard.css";
import { COMMANDS, query, queryGet } from "../api";
import type { Command } from "../api";
import { ReportView } from "../components/reports";

interface HistoryEntry {
  command: Command;
  address: string;
  timestamp: number;
  success: boolean;
}

const CHAIN_OPTIONS = ["base", "ethereum", "arbitrum", "optimism", "polygon", "avalanche", "bsc"];

const ANALYTICS_CMDS: Command[] = ["quick", "research", "pnl", "defi", "history", "nft", "compare"];
const WALLET_CMDS: Command[] = ["balance", "swap", "bridge", "send"];
const MONITOR_CMDS: Command[] = ["watch", "unwatch"];

const ADDRESS_CMDS: Command[] = ["quick", "research", "pnl", "defi", "history", "nft", "balance", "watch", "unwatch"];

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

function cmdInfo(cmd: Command): { label: string; price: string } {
  const found = COMMANDS.find((c) => c.cmd === cmd);
  return found ? { label: found.label, price: found.price } : { label: `/${cmd}`, price: "" };
}

export function Dashboard(): ReactNode {
  const [activeCmd, setActiveCmd] = useState<Command>("research");
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
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<unknown>(null);
  const [reportCmd, setReportCmd] = useState<Command | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const canSubmit = useCallback((): boolean => {
    if (loading) return false;
    if (ADDRESS_CMDS.includes(activeCmd)) return !!input.trim();
    if (activeCmd === "compare") return !!input.trim() && !!inputB.trim();
    if (activeCmd === "swap") return !!amount.trim() && !!inputToken.trim() && !!outputToken.trim();
    if (activeCmd === "bridge") return !!amount.trim() && !!symbol.trim();
    if (activeCmd === "send") return !!amount.trim() && !!symbol.trim() && !!toAddress.trim();
    return false;
  }, [loading, activeCmd, input, inputB, amount, inputToken, outputToken, symbol, toAddress]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    setLoading(true);
    setError(null);
    setReportData(null);

    const label = input.trim() || amount.trim() || "action";

    try {
      let data: unknown;

      if (activeCmd === "balance") {
        data = await queryGet<unknown>(`/balance?address=${encodeURIComponent(input.trim())}`);
      } else if (activeCmd === "compare") {
        data = await query<unknown>(activeCmd, { address: input.trim(), addressB: inputB.trim() });
      } else if (activeCmd === "swap") {
        data = await query<unknown>(activeCmd, {
          amount: amount.trim(),
          inputToken: inputToken.trim(),
          outputToken: outputToken.trim(),
          chain,
        });
      } else if (activeCmd === "bridge") {
        data = await query<unknown>(activeCmd, {
          amount: amount.trim(),
          symbol: symbol.trim(),
          fromChain,
          toChain,
        });
      } else if (activeCmd === "send") {
        data = await query<unknown>(activeCmd, {
          amount: amount.trim(),
          symbol: symbol.trim(),
          toAddress: toAddress.trim(),
          chain,
        });
      } else {
        data = await query<unknown>(activeCmd, { address: input.trim() });
      }

      setReportData(data);
      setReportCmd(activeCmd);
      setHistory((prev) => [
        { command: activeCmd, address: label, timestamp: Date.now(), success: true },
        ...prev,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setHistory((prev) => [
        { command: activeCmd, address: label, timestamp: Date.now(), success: false },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  }, [activeCmd, input, inputB, amount, inputToken, outputToken, symbol, chain, fromChain, toChain, toAddress, canSubmit]);

  const renderCmdGroup = (label: string, cmds: Command[]): ReactNode => (
    <div className="cmd-group">
      <span className="cmd-group-label">{label}</span>
      <div className="cmd-group-tabs">
        {cmds.map((cmd) => {
          const info = cmdInfo(cmd);
          return (
            <button
              key={cmd}
              className={`cmd-tab${activeCmd === cmd ? " active" : ""}`}
              onClick={() => setActiveCmd(cmd)}
              type="button"
            >
              {info.label}
              <span className="price">{info.price}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderFormFields = (): ReactNode => {
    if (ADDRESS_CMDS.includes(activeCmd)) {
      return (
        <div className="search-row">
          <input
            className="search-input"
            type="text"
            placeholder="Wallet address (0x...)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="search-btn" type="submit" disabled={!canSubmit()}>
            {loading ? "Processing..." : "Submit"}
          </button>
        </div>
      );
    }

    if (activeCmd === "compare") {
      return (
        <div className="search-row">
          <input
            className="search-input"
            type="text"
            placeholder="Wallet address A (0x...)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <input
            className="search-input"
            type="text"
            placeholder="Wallet address B (0x...)"
            value={inputB}
            onChange={(e) => setInputB(e.target.value)}
          />
          <button className="search-btn" type="submit" disabled={!canSubmit()}>
            {loading ? "Analyzing..." : "Compare"}
          </button>
        </div>
      );
    }

    if (activeCmd === "swap") {
      return (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>Amount</label>
              <input type="text" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Input Token</label>
              <input type="text" placeholder="USDC" value={inputToken} onChange={(e) => setInputToken(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Output Token</label>
              <input type="text" placeholder="ETH" value={outputToken} onChange={(e) => setOutputToken(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Chain</label>
              <select value={chain} onChange={(e) => setChain(e.target.value)}>
                {CHAIN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="search-row" style={{ marginTop: 8 }}>
            <button className="search-btn" type="submit" disabled={!canSubmit()} style={{ marginLeft: "auto" }}>
              {loading ? "Processing..." : "Swap"}
            </button>
          </div>
        </>
      );
    }

    if (activeCmd === "bridge") {
      return (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>Amount</label>
              <input type="text" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Token</label>
              <input type="text" placeholder="USDC" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            </div>
            <div className="form-field">
              <label>From Chain</label>
              <select value={fromChain} onChange={(e) => setFromChain(e.target.value)}>
                {CHAIN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>To Chain</label>
              <select value={toChain} onChange={(e) => setToChain(e.target.value)}>
                {CHAIN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="search-row" style={{ marginTop: 8 }}>
            <button className="search-btn" type="submit" disabled={!canSubmit()} style={{ marginLeft: "auto" }}>
              {loading ? "Processing..." : "Bridge"}
            </button>
          </div>
        </>
      );
    }

    if (activeCmd === "send") {
      return (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>Amount</label>
              <input type="text" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Token</label>
              <input type="text" placeholder="USDC" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Recipient</label>
              <input type="text" placeholder="0x..." value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Chain</label>
              <select value={chain} onChange={(e) => setChain(e.target.value)}>
                {CHAIN_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="search-row" style={{ marginTop: 8 }}>
            <button className="search-btn" type="submit" disabled={!canSubmit()} style={{ marginLeft: "auto" }}>
              {loading ? "Processing..." : "Send"}
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="topbar-logo">OWS Intelligence Wire</Link>
          <nav className="topbar-nav">
            <span className="active">Research</span>
            <span>Docs</span>
          </nav>
        </div>
      </header>

      <div className="main">
        <div className="search-area">
          <div className="search-top">
            <h1>Wallet Intelligence</h1>
            <div className="cmd-groups">
              {renderCmdGroup("Analytics", ANALYTICS_CMDS)}
              {renderCmdGroup("Wallet", WALLET_CMDS)}
              {renderCmdGroup("Monitor", MONITOR_CMDS)}
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            {renderFormFields()}
          </form>
          <div className="search-hint">
            Pay-per-call via x402 USDC on Base. No subscription required.
          </div>
        </div>

        {error && (
          <div className="error-box">{error}</div>
        )}

        {loading && (
          <div className="loading-state">
            <p>Running analysis...</p>
          </div>
        )}

        {!loading && reportData != null && reportCmd != null ? (
          <ReportView command={reportCmd} data={reportData} />
        ) : null}

        {!loading && !reportData && !error && (
          <div className="empty-state">
            <p>Enter a wallet address and select a command to begin analysis.</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="query-history">
            <h3>Query History</h3>
            <table>
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Address</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr key={`${entry.timestamp}-${i}`}>
                    <td><span className="mono">/{entry.command}</span></td>
                    <td><span className="mono">{shortAddr(entry.address)}</span></td>
                    <td className="mono">{new Date(entry.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span className={`badge ${entry.success ? "badge-low" : "badge-high"}`}>
                        {entry.success ? "OK" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
