import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode, FormEvent } from "react";
import type { BridgeState } from "../hooks/useBridge";
import { formatMessage } from "./formatMessage";
import type { FormatContext } from "./formatMessage";

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  time: Date;
}

interface ChatPanelProps {
  bridge: BridgeState;
  onClose: () => void;
}

const COMMANDS = [
  { cmd: "/quick", desc: "Portfolio snapshot", price: "$0.01" },
  { cmd: "/research", desc: "Deep AI research", price: "$0.05" },
  { cmd: "/pnl", desc: "Profit & loss", price: "$0.02" },
  { cmd: "/defi", desc: "DeFi positions", price: "$0.02" },
  { cmd: "/history", desc: "Transaction history", price: "$0.02" },
  { cmd: "/nft", desc: "NFT portfolio", price: "$0.02" },
  { cmd: "/compare", desc: "Compare wallets", price: "$0.05" },
  { cmd: "/balance", desc: "Wallet balance", price: "free" },
  { cmd: "/help", desc: "Show commands", price: "free" },
];

const SUGGESTIONS = [
  "/quick 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "/balance",
  "/help",
];

function CommandList({ filter, onSelect, activeIdx }: {
  filter: string;
  onSelect: (cmd: string) => void;
  activeIdx: number;
}) {
  const list = COMMANDS.filter(c => c.cmd.startsWith(filter.toLowerCase()));
  if (!list.length) return null;

  return (
    <div className="chat-cmd-list">
      {list.map((c, i) => (
        <button
          key={c.cmd}
          className={`chat-cmd-item ${i === activeIdx ? "active" : ""}`}
          onClick={() => onSelect(c.cmd + " ")}
        >
          <span className="chat-cmd-name">{c.cmd}</span>
          <span className="chat-cmd-desc">{c.desc}</span>
          <span className="chat-cmd-price">{c.price}</span>
        </button>
      ))}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="chat-copy" onClick={copy} title="Copy">
      {copied ? "\u2713" : "\u2398"}
    </button>
  );
}

export function ChatPanel({ bridge, onClose }: ChatPanelProps): ReactNode {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCmds, setShowCmds] = useState(false);
  const [cmdIdx, setCmdIdx] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scroll, [messages, scroll]);

  // Command popup toggle
  useEffect(() => {
    setShowCmds(input.startsWith("/"));
    setCmdIdx(0);
  }, [input]);

  // WebSocket connection
  useEffect(() => {
    if (bridge.status !== "connected") return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/chat?session=${bridge.sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("ready");
    ws.onmessage = (e) => {
      let msg: { type: string; id?: string; text?: string; sender?: string; error?: string };
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === "message" && msg.text) {
        setLoading(false);
        setMessages((prev) => {
          const m: ChatMessage = {
            id: msg.id || `msg_${Date.now()}`,
            sender: (msg.sender === "user" ? "user" : "agent"),
            text: msg.text!,
            time: new Date(),
          };
          if (prev.some((p) => p.id === m.id)) return prev;
          return [...prev, m];
        });
      }
      if (msg.type === "error") setError(msg.error || "Unknown error");
      if (msg.type === "history" && Array.isArray((msg as unknown as { messages: unknown[] }).messages)) {
        const h = (msg as unknown as { messages: { id: string; sender: string; text: string; time: string }[] }).messages;
        setMessages(h.map((m) => ({
          id: m.id,
          sender: m.sender === "user" ? "user" as const : "agent" as const,
          text: m.text,
          time: new Date(m.time),
        })));
      }
    };
    ws.onclose = () => setStatus("error");
    ws.onerror = () => { setStatus("error"); setError("Connection failed"); };
    return () => { ws.close(); wsRef.current = null; };
  }, [bridge.status, bridge.sessionId]);

  const doSend = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setInput("");
    setMessages((prev) => [...prev, {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: text.trim(),
      time: new Date(),
    }]);
    setLoading(true);
    wsRef.current.send(JSON.stringify({ type: "message", text: text.trim() }));
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    doSend(input);
  }, [input, doSend]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (!showCmds) return;
    const list = COMMANDS.filter(c => c.cmd.startsWith(input.toLowerCase()));
    if (!list.length) return;
    if (e.key === "ArrowUp") { e.preventDefault(); setCmdIdx(i => i > 0 ? i - 1 : list.length - 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setCmdIdx(i => i < list.length - 1 ? i + 1 : 0); }
    else if (e.key === "Tab") { e.preventDefault(); setInput(list[cmdIdx].cmd + " "); setShowCmds(false); }
  }, [showCmds, input, cmdIdx]);

  if (bridge.status !== "connected") {
    return (
      <div className="chat-panel">
        <div className="chat-header">
          <span>XMTP Chat</span>
          <button className="chat-close" onClick={onClose} type="button">&times;</button>
        </div>
        <div className="chat-empty-state">
          <div className="chat-empty-icon">&#x1F50D;</div>
          <p>Connect your OWS wallet to start.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>XMTP Chat</span>
        <div className="chat-header-r">
          <span className={`chat-status ${status}`}>
            {status === "connecting" && "Connecting..."}
            {status === "ready" && "Connected"}
            {status === "error" && "Disconnected"}
          </span>
          <button className="chat-close" onClick={onClose} type="button">&times;</button>
        </div>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-messages">
        {messages.length === 0 && status === "ready" && (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">&#x1F916;</div>
            <h3 className="chat-empty-title">Dossier Agent</h3>
            <p className="chat-empty-sub">Wallet intelligence at your fingertips</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="chat-suggestion" onClick={() => doSend(s)}>
                  {s.length > 20 ? s.slice(0, 18) + "..." : s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          // Find full address from preceding user message for action buttons
          let lastAddr: string | undefined;
          if (msg.sender === "agent") {
            for (let j = idx - 1; j >= 0; j--) {
              if (messages[j].sender === "user") {
                lastAddr = messages[j].text.match(/0x[a-fA-F0-9]{40}/)?.[0];
                break;
              }
            }
          }
          return (
          <div key={msg.id} className={`chat-msg ${msg.sender}`}>
            <div className="chat-msg-meta">
              <span className="chat-msg-sender">{msg.sender === "user" ? "You" : "Dossier"}</span>
              <span className="chat-msg-time">{msg.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="chat-msg-bubble">
              <div className="chat-msg-text">
                {msg.sender === "agent"
                  ? formatMessage(msg.text, { onCommand: doSend, lastAddress: lastAddr })
                  : msg.text}
              </div>
              {msg.sender === "agent" && <CopyBtn text={msg.text} />}
            </div>
          </div>
          );
        })}

        {loading && (
          <div className="chat-loading">
            <span className="chat-loading-dot" />
            <span>Processing...</span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        {showCmds && (
          <CommandList
            filter={input}
            onSelect={(cmd) => { setInput(cmd); setShowCmds(false); }}
            activeIdx={cmdIdx}
          />
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={status === "ready" ? "Type a command..." : "Connecting..."}
          disabled={status !== "ready"}
        />
        <button type="submit" disabled={status !== "ready" || !input.trim()} className="chat-send">
          &#x27A4;
        </button>
      </form>
    </div>
  );
}
