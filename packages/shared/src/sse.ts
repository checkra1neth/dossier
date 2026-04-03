import type { Request, Response } from "express";
import type { WireMessage, AgentName } from "./types.ts";

const clients: Set<Response> = new Set();

export function sseHandler(_req: Request, res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

export function broadcastSSE(agent: AgentName, msg: WireMessage): void {
  const payload = JSON.stringify({ agent, wireMessage: msg });
  for (const client of clients) {
    client.write(`data: ${payload}\n\n`);
  }
}
