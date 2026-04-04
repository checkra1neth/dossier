import { useState, useEffect, useRef, useCallback } from "react";
import { setBridgeSession } from "../api";

type BridgeStatus = "waiting" | "connected" | "disconnected";

export interface BridgeState {
  sessionId: string;
  status: BridgeStatus;
  address: string | null;
  name: string | null;
  connectCommand: string;
  signMessage: (message: string) => Promise<Uint8Array>;
}

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
}

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

let reqCounter = 0;

export function useBridge(): BridgeState {
  const [sessionId] = useState(() => generateSessionId());
  const [status, setStatus] = useState<BridgeStatus>("waiting");
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

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
      let msg: { type: string; address?: string; name?: string; id?: string; signature?: string; reason?: string };
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

      // Sign response relay from server
      if (msg.type === "sign_response" && msg.id && msg.signature) {
        const req = pendingRef.current.get(msg.id);
        if (req) {
          pendingRef.current.delete(msg.id);
          req.resolve(msg.signature);
        }
      }

      if (msg.type === "sign_rejected" && msg.id) {
        const req = pendingRef.current.get(msg.id);
        if (req) {
          pendingRef.current.delete(msg.id);
          req.reject(new Error(msg.reason ?? "Signing rejected"));
        }
      }
    };

    ws.onclose = () => {
      if (status === "connected") {
        setStatus("disconnected");
        setAddress(null);
        setName(null);
      }
      // Reject all pending
      for (const [, req] of pendingRef.current) {
        req.reject(new Error("Bridge disconnected"));
      }
      pendingRef.current.clear();
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

  const signMessage = useCallback(async (message: string): Promise<Uint8Array> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Bridge not connected");
    }

    const id = `br_${++reqCounter}`;

    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error("Sign timeout (60s)"));
      }, 60_000);

      pendingRef.current.set(id, {
        resolve: (sigHex: string) => {
          clearTimeout(timer);
          // Convert hex string to Uint8Array
          const hex = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          }
          resolve(bytes);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      // Send sign request — server relays to CLI signer
      ws.send(JSON.stringify({
        type: "sign_request",
        id,
        method: "signMessage",
        params: { message, description: "XMTP identity" },
      }));
    });
  }, []);

  const connectCommand = `npm run bridge ${sessionId}`;

  return { sessionId, status, address, name, connectCommand, signMessage };
}
