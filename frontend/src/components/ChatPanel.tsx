import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode, FormEvent } from "react";
import type { BridgeState } from "../hooks/useBridge";

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

export function ChatPanel({ bridge, onClose }: ChatPanelProps): ReactNode {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"connecting" | "ready" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // Connect to chat WebSocket
  useEffect(() => {
    if (bridge.status !== "connected") return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/chat?session=${bridge.sessionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("ready");
    };

    ws.onmessage = (e) => {
      let msg: { type: string; id?: string; text?: string; sender?: string; error?: string };
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === "message" && msg.text) {
        setMessages((prev) => {
          const chatMsg: ChatMessage = {
            id: msg.id || `msg_${Date.now()}`,
            sender: (msg.sender === "user" ? "user" : "agent") as "user" | "agent",
            text: msg.text!,
            time: new Date(),
          };
          if (prev.some((m) => m.id === chatMsg.id)) return prev;
          return [...prev, chatMsg];
        });
      }

      if (msg.type === "error") {
        setError(msg.error || "Unknown error");
      }

      if (msg.type === "history" && Array.isArray((msg as unknown as { messages: unknown[] }).messages)) {
        const history = (msg as unknown as { messages: { id: string; sender: string; text: string; time: string }[] }).messages;
        setMessages(history.map((m) => ({
          id: m.id,
          sender: m.sender === "user" ? "user" as const : "agent" as const,
          text: m.text,
          time: new Date(m.time),
        })));
      }
    };

    ws.onclose = () => {
      setStatus("error");
    };

    ws.onerror = () => {
      setStatus("error");
      setError("Chat connection failed");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [bridge.status, bridge.sessionId]);

  const handleSend = useCallback((e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setInput("");

    const id = `usr_${Date.now()}`;
    // Optimistic UI — show user message immediately
    setMessages((prev) => [...prev, {
      id,
      sender: "user",
      text,
      time: new Date(),
    }]);

    wsRef.current.send(JSON.stringify({ type: "message", text }));
  }, [input]);

  if (bridge.status !== "connected") {
    return (
      <div className="chat-panel">
        <div className="chat-header">
          <span>XMTP Chat</span>
          <button className="chat-close" onClick={onClose} type="button">x</button>
        </div>
        <div className="chat-empty">
          Connect your OWS wallet to start chatting with the agent.
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
          <button className="chat-close" onClick={onClose} type="button">x</button>
        </div>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-messages">
        {messages.length === 0 && status === "ready" && (
          <div className="chat-hint">
            Send a command to the agent, e.g. <code>/quick 0xd8dA...96045</code>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.sender}`}>
            <div className="chat-msg-meta">
              <span className="chat-msg-sender">{msg.sender === "user" ? "You" : "Dossier"}</span>
              <span className="chat-msg-time">{msg.time.toLocaleTimeString()}</span>
            </div>
            <div className="chat-msg-text">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={status === "ready" ? "Type a command..." : "Connecting..."}
          disabled={status !== "ready"}
        />
        <button type="submit" disabled={status !== "ready" || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
