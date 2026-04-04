import { useState, useEffect, useRef, useCallback } from "react";
import { setBridgeSession } from "../api";

type BridgeStatus = "waiting" | "connected" | "disconnected";

interface BridgeState {
  sessionId: string;
  status: BridgeStatus;
  address: string | null;
  name: string | null;
  connectCommand: string;
}

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function useBridge(): BridgeState {
  const [sessionId] = useState(() => generateSessionId());
  const [status, setStatus] = useState<BridgeStatus>("waiting");
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);

  const connectWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?session=${sessionId}&role=browser`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setBridgeSession(sessionId);
    };

    ws.onmessage = (e) => {
      let msg: { type: string; address?: string; name?: string };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "paired" && msg.address) {
        setStatus("connected");
        setAddress(msg.address);
        setName(msg.name ?? null);
      }

      if (msg.type === "disconnected") {
        setStatus("waiting");
        setAddress(null);
        setName(null);
      }
    };

    ws.onclose = () => {
      if (status === "connected") {
        setStatus("disconnected");
        setAddress(null);
        setName(null);
      }
      // Reconnect up to 3 times
      if (retriesRef.current < 3) {
        retriesRef.current++;
        setTimeout(connectWs, 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, status]);

  useEffect(() => {
    connectWs();
    return () => {
      setBridgeSession(null);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWs]);

  const connectCommand = `npm run bridge ${sessionId}`;

  return { sessionId, status, address, name, connectCommand };
}
