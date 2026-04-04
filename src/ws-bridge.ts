import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import crypto from "node:crypto";

interface PendingRequest {
  resolve: (signature: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Session {
  browser: WebSocket | null;
  signer: WebSocket | null;
  address: string | null;
  name: string | null;
  pending: Map<string, PendingRequest>;
  createdAt: number;
}

const sessions = new Map<string, Session>();

const SESSION_TTL = 5 * 60 * 1000; // 5 min for unpaired sessions
const SIGN_TIMEOUT = 60_000; // 60s to sign

function getOrCreateSession(sessionId: string): Session {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { browser: null, signer: null, address: null, name: null, pending: new Map(), createdAt: Date.now() };
    sessions.set(sessionId, s);
  }
  return s;
}

function send(ws: WebSocket | null, msg: object): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function cleanupSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  for (const [, req] of s.pending) {
    clearTimeout(req.timer);
    req.reject(new Error("Session closed"));
  }
  s.pending.clear();
  sessions.delete(sessionId);
}

// Periodic cleanup of stale unpaired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (!s.signer && !s.browser && now - s.createdAt > SESSION_TTL) {
      cleanupSession(id);
    }
  }
}, 30_000);

export function setupBridge(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const sessionId = url.searchParams.get("session");
    const role = url.searchParams.get("role");

    if (!sessionId || !role || !["browser", "signer"].includes(role)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const session = getOrCreateSession(sessionId);

      if (role === "browser") {
        if (session.browser) session.browser.close();
        session.browser = ws;
        console.log(`[bridge] Browser connected: session=${sessionId}`);

        // If signer already connected, notify browser
        if (session.signer && session.address) {
          send(ws, { type: "paired", address: session.address, name: session.name });
        }

        // Relay sign requests from browser to signer
        ws.on("message", (raw) => {
          let msg: { type: string; id?: string };
          try { msg = JSON.parse(raw.toString()); } catch { return; }

          console.log(`[bridge] Browser message: type=${msg.type}, signer=${!!session.signer}`);
          if (msg.type === "sign_request" && msg.id && session.signer) {
            console.log(`[bridge] Relaying sign_request ${msg.id} to signer`);
            // Forward to signer, track pending so response goes back to browser
            const pending = session.pending;
            pending.set(msg.id, {
              resolve: (signature: string) => { send(session.browser, { type: "sign_response", id: msg.id, signature }); },
              reject: (err: Error) => { send(session.browser, { type: "sign_rejected", id: msg.id, reason: err.message }); },
              timer: setTimeout(() => {
                pending.delete(msg.id!);
                send(session.browser, { type: "sign_rejected", id: msg.id, reason: "Signing timeout" });
              }, 60_000),
            });
            send(session.signer, JSON.parse(raw.toString()));
          }
        });

        ws.on("close", () => {
          if (session.browser === ws) session.browser = null;
          if (!session.signer && !session.browser) cleanupSession(sessionId);
        });
      }

      if (role === "signer") {
        if (session.signer) session.signer.close();
        session.signer = ws;
        console.log(`[bridge] Signer connected: session=${sessionId}`);

        ws.on("message", (raw) => {
          let msg: { type: string; address?: string; name?: string; id?: string; signature?: string; reason?: string };
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }

          if (msg.type === "hello" && msg.address) {
            session.address = msg.address;
            session.name = msg.name ?? "unknown";
            console.log(`[bridge] Signer identified: ${session.name} (${session.address})`);
            send(session.browser, { type: "paired", address: session.address, name: session.name });
          }

          if (msg.type === "sign_response" && msg.id && msg.signature) {
            const req = session.pending.get(msg.id);
            if (req) {
              clearTimeout(req.timer);
              session.pending.delete(msg.id);
              req.resolve(msg.signature);
            }
          }

          if (msg.type === "sign_rejected" && msg.id) {
            const req = session.pending.get(msg.id);
            if (req) {
              clearTimeout(req.timer);
              session.pending.delete(msg.id);
              req.reject(new Error(msg.reason ?? "Signing rejected"));
            }
          }
        });

        ws.on("close", () => {
          if (session.signer === ws) {
            session.signer = null;
            session.address = null;
            session.name = null;
            send(session.browser, { type: "disconnected" });
            // Reject all pending requests
            for (const [id, req] of session.pending) {
              clearTimeout(req.timer);
              req.reject(new Error("Signer disconnected"));
              session.pending.delete(id);
            }
          }
          if (!session.signer && !session.browser) cleanupSession(sessionId);
        });
      }
    });
  });

  console.log("[bridge] WebSocket bridge ready on /ws");
}

export function getSession(sessionId: string): { address: string; name: string; connected: boolean } | null {
  const s = sessions.get(sessionId);
  if (!s || !s.signer || !s.address) return null;
  return { address: s.address, name: s.name ?? "unknown", connected: true };
}

export function requestSignature(
  sessionId: string,
  method: string,
  params: object,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = sessions.get(sessionId);
    if (!s || !s.signer || s.signer.readyState !== WebSocket.OPEN) {
      reject(new Error("No signer connected"));
      return;
    }

    const id = `req_${crypto.randomBytes(4).toString("hex")}`;
    const timer = setTimeout(() => {
      s.pending.delete(id);
      reject(new Error("Signing timeout (60s)"));
    }, SIGN_TIMEOUT);

    s.pending.set(id, { resolve, reject, timer });
    send(s.signer, { type: "sign_request", id, method, params });
  });
}
