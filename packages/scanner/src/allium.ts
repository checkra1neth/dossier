import WebSocket from "ws";
import { envOptional } from "@wire/shared/config";

export interface AlliumTx {
  hash: string;
  from: string;
  to: string;
  value: string; // ETH as string
  chain: string;
}

const WHALE_ADDRESSES: { label: string; address: string }[] = [
  { label: "vitalik.eth", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { label: "Binance", address: "0x28C6c06298d514Db089934071355E5743bf21d60" },
  { label: "Jump Trading", address: "0xDa9CE944a37d218c3302F6B82a094844C6ECEb17" },
  { label: "Wintermute", address: "0x56Eddb7aa87536c09CCc2793473599fD21A8b17F" },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startMockStream(onEvent: (tx: AlliumTx) => void): void {
  console.log("[scanner] No ALLIUM_API_KEY — running mock whale stream");

  const emit = (): void => {
    const whale = WHALE_ADDRESSES[randomBetween(0, WHALE_ADDRESSES.length - 1)];
    const value = (randomBetween(100, 5000) + Math.random()).toFixed(4);
    const tx: AlliumTx = {
      hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      from: whale.address,
      to: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      value,
      chain: "ethereum",
    };
    console.log(`[scanner][mock] ${whale.label} moved ${value} ETH`);
    onEvent(tx);

    const delay = randomBetween(15, 45) * 1000;
    setTimeout(emit, delay);
  };

  // First event after 3 seconds
  setTimeout(emit, 3000);
}

function startLiveStream(apiKey: string, onEvent: (tx: AlliumTx) => void): void {
  const url = "wss://api.allium.so/api/v1/developer/ws/stream?topic=ethereum.transactions";

  const connect = (): void => {
    const ws = new WebSocket(url, { headers: { "X-API-KEY": apiKey } });

    ws.on("open", () => {
      console.log("[scanner] Connected to Allium WebSocket");
    });

    ws.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        const valueEth = parseFloat(data.value || "0") / 1e18;
        if (valueEth < 100) return; // Filter: only > 100 ETH

        const tx: AlliumTx = {
          hash: data.hash || data.transaction_hash || "",
          from: data.from_address || data.from || "",
          to: data.to_address || data.to || "",
          value: valueEth.toFixed(4),
          chain: "ethereum",
        };
        onEvent(tx);
      } catch {
        // skip malformed messages
      }
    });

    ws.on("close", () => {
      console.log("[scanner] Allium WS closed, reconnecting in 5s...");
      setTimeout(connect, 5000);
    });

    ws.on("error", (err: Error) => {
      console.error("[scanner] Allium WS error:", err.message);
      ws.close();
    });
  };

  connect();
}

export function startAlliumStream(onEvent: (tx: AlliumTx) => void): void {
  const apiKey = envOptional("ALLIUM_API_KEY");
  if (apiKey) {
    startLiveStream(apiKey, onEvent);
  } else {
    startMockStream(onEvent);
  }
}
