import { useState, useCallback } from "react";
import type { ReactNode, FormEvent } from "react";
import { Link } from "react-router-dom";
import "../styles/dashboard.css";
import { COMMANDS, query } from "../api";
import type { Command } from "../api";
import { ReportView } from "../components/reports";

interface HistoryEntry {
  command: Command;
  address: string;
  timestamp: number;
  success: boolean;
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

export function Dashboard(): ReactNode {
  const [activeCmd, setActiveCmd] = useState<Command>("research");
  const [input, setInput] = useState("");
  const [inputB, setInputB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<unknown>(null);
  const [reportCmd, setReportCmd] = useState<Command | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const addr = input.trim();
    if (!addr) return;

    setLoading(true);
    setError(null);
    setReportData(null);

    const body: Record<string, string> = { address: addr };
    if (activeCmd === "compare") {
      const addrB = inputB.trim();
      if (!addrB) {
        setError("Two addresses required for comparison");
        setLoading(false);
        return;
      }
      body.addressB = addrB;
    }

    try {
      const data = await query<unknown>(activeCmd, body);
      setReportData(data);
      setReportCmd(activeCmd);
      setHistory((prev) => [
        { command: activeCmd, address: addr, timestamp: Date.now(), success: true },
        ...prev,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setHistory((prev) => [
        { command: activeCmd, address: addr, timestamp: Date.now(), success: false },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  }, [activeCmd, input, inputB]);

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
            <div className="cmd-tabs">
              {COMMANDS.map((c) => (
                <button
                  key={c.cmd}
                  className={`cmd-tab${activeCmd === c.cmd ? " active" : ""}`}
                  onClick={() => setActiveCmd(c.cmd)}
                  type="button"
                >
                  {c.label}
                  <span className="price">{c.price}</span>
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="search-row">
              <input
                className="search-input"
                type="text"
                placeholder={activeCmd === "compare" ? "Wallet address A (0x...)" : "Wallet address (0x...)"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              {activeCmd === "compare" && (
                <input
                  className="search-input"
                  type="text"
                  placeholder="Wallet address B (0x...)"
                  value={inputB}
                  onChange={(e) => setInputB(e.target.value)}
                />
              )}
              <button className="search-btn" type="submit" disabled={loading || !input.trim()}>
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
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
