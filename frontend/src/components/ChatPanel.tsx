import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode, FormEvent } from "react";
import { Client, IdentifierKind } from "@xmtp/browser-sdk";
import type { Dm, DecodedMessage } from "@xmtp/browser-sdk";
import type { BridgeState } from "../hooks/useBridge";

const AGENT_ADDRESS = "0x0FA241E47b1F1Be40c20e84B3BCF8022537eDf86";
const XMTP_ENV = "dev" as const;

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  time: Date;
}

interface ChatPanelProps {
  bridge: BridgeState;
}

export function ChatPanel({ bridge }: ChatPanelProps): ReactNode {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [xmtpStatus, setXmtpStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<Client<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dmRef = useRef<Dm<any> | null>(null);
  const streamRef = useRef<{ end: () => Promise<unknown> } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  // Initialize XMTP client when bridge connects
  useEffect(() => {
    if (bridge.status !== "connected" || !bridge.address || xmtpStatus !== "idle") return;

    let cancelled = false;

    async function initXmtp(): Promise<void> {
      setXmtpStatus("connecting");
      setError(null);

      try {
        const signer = {
          type: "EOA" as const,
          getIdentifier: () => ({
            identifier: bridge.address!.toLowerCase(),
            identifierKind: IdentifierKind.Ethereum,
          }),
          signMessage: bridge.signMessage,
        };

        console.log("[xmtp-chat] Creating client...");
        const client = await Client.create(signer, {
          env: XMTP_ENV,
        } as Parameters<typeof Client.create>[1]);

        if (cancelled) { client.close(); return; }
        clientRef.current = client;
        console.log("[xmtp-chat] Client ready, inboxId:", client.inboxId);

        // Sync conversations from network
        console.log("[xmtp-chat] Syncing conversations...");
        await client.conversations.sync();

        // Create or find DM with agent
        console.log("[xmtp-chat] Creating DM with agent:", AGENT_ADDRESS);
        const dm = await client.conversations.createDmWithIdentifier({
          identifier: AGENT_ADDRESS.toLowerCase(),
          identifierKind: IdentifierKind.Ethereum,
        });

        if (cancelled) { client.close(); return; }
        dmRef.current = dm;
        console.log("[xmtp-chat] DM created, id:", dm.id);

        // Load message history
        const history = await dm.messages({ limit: BigInt(50) });
        const clientInboxId = client.inboxId;

        const mapped: ChatMessage[] = history.map((m: DecodedMessage) => ({
          id: m.id,
          sender: m.senderInboxId === clientInboxId ? "user" as const : "agent" as const,
          text: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          time: new Date(m.sentAtNs ? Number(m.sentAtNs) / 1_000_000 : Date.now()),
        }));
        setMessages(mapped);

        // Stream new messages
        const stream = await dm.stream({
          onValue: (msg: DecodedMessage) => {
            const chatMsg: ChatMessage = {
              id: msg.id,
              sender: msg.senderInboxId === clientInboxId ? "user" : "agent",
              text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
              time: new Date(msg.sentAtNs ? Number(msg.sentAtNs) / 1_000_000 : Date.now()),
            };
            setMessages((prev) => {
              if (prev.some((m) => m.id === chatMsg.id)) return prev;
              return [...prev, chatMsg];
            });
          },
        });
        streamRef.current = stream;

        setXmtpStatus("ready");
      } catch (err) {
        console.error("[xmtp-chat] Error:", err);
        if (!cancelled) {
          setXmtpStatus("error");
          setError(err instanceof Error ? err.message : "XMTP connection failed");
        }
      }
    }

    initXmtp();
    return () => { cancelled = true; };
  }, [bridge.status, bridge.address, bridge.signMessage, xmtpStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.end();
      clientRef.current?.close();
    };
  }, []);

  const handleSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !dmRef.current) return;
    setInput("");

    try {
      await dmRef.current.sendText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  }, [input]);

  if (bridge.status !== "connected") {
    return (
      <div className="chat-panel">
        <div className="chat-header">XMTP Chat</div>
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
        <span className={`chat-status ${xmtpStatus}`}>
          {xmtpStatus === "connecting" && "Connecting..."}
          {xmtpStatus === "ready" && "E2E Encrypted"}
          {xmtpStatus === "error" && "Error"}
          {xmtpStatus === "idle" && "Initializing..."}
        </span>
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-messages">
        {messages.length === 0 && xmtpStatus === "ready" && (
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
          placeholder={xmtpStatus === "ready" ? "Type a command..." : "Connecting to XMTP..."}
          disabled={xmtpStatus !== "ready"}
        />
        <button type="submit" disabled={xmtpStatus !== "ready" || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
