export interface WireMessage {
  type: "raw_event" | "enriched_event" | "signal" | "trade_result" | "status";
  from: "scanner" | "enricher" | "analyst" | "trader" | "distributor";
  timestamp: number;
  data: RawEvent | EnrichedEvent | Signal | TradeResult | StatusUpdate;
}

export interface RawEvent {
  chain: string;
  txHash: string;
  from: string;
  to: string;
  valueUsd: number;
  type: "whale_transfer" | "large_dex_trade" | "gas_spike";
}

export interface EnrichedEvent extends RawEvent {
  walletProfile: {
    totalValueUsd: number;
    topPositions: { asset: string; valueUsd: number }[];
    txCount30d: number;
    isSmartMoney: boolean;
  };
}

export interface Signal {
  id: string;
  action: "BUY" | "SELL" | "WATCH";
  asset: string;
  confidence: number;
  reasoning: string;
  basedOn: string;
}

export interface TradeResult {
  signalId: string;
  platform: "myriad" | "dflow" | "moonpay" | "ripple";
  action: string;
  amount: number;
  status: "success" | "failed";
  txHash?: string;
}

export interface StatusUpdate {
  message: string;
  subscriberCount?: number;
}

export type AgentName = "scanner" | "enricher" | "analyst" | "trader" | "distributor";

export interface SSEEvent {
  agent: AgentName;
  wireMessage: WireMessage;
}
