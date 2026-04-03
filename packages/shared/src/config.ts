import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

// Load .env from project root
try {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(currentDir, "../../../.env");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

export const PORTS: Record<string, number> = {
  scanner: 4001,
  enricher: 4002,
  analyst: 4003,
  distributor: 4004,
  trader: 4005,
  dashboard: 3000,
};

export function getWalletKey(agent: string): `0x${string}` {
  const key = process.env[`${agent.toUpperCase()}_WALLET_KEY`];
  if (!key) throw new Error(`Missing ${agent.toUpperCase()}_WALLET_KEY in .env`);
  return key as `0x${string}`;
}

export function getDbEncryptionKey(agent: string): Uint8Array {
  const hex = process.env[`${agent.toUpperCase()}_DB_KEY`];
  if (!hex) throw new Error(`Missing ${agent.toUpperCase()}_DB_KEY in .env`);
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(clean, "hex"));
}

export function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export function envOptional(key: string): string | undefined {
  return process.env[key] || undefined;
}
