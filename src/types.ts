import {
  PortfolioData,
  Position,
  DefiPosition,
  PnlData,
  Transaction,
  NftCollection,
} from "./services/zerion.ts";

export type {
  PortfolioData,
  Position,
  DefiPosition,
  PnlData,
  Transaction,
  NftCollection,
};

export interface ZerionData {
  totalValueUsd: number;
  chains: string[];
  topPositions: { asset: string; valueUsd: number; percentage: number }[];
  isSmartMoney: boolean;
  positionCount: number;
}

export interface Analysis {
  summary: string;
  riskLevel: "low" | "medium" | "high";
  patterns: string[];
  verdict: string;
}

export interface ResearchReport {
  address: string;
  timestamp: number;
  data: ZerionData;
  analysis: Analysis;
}

export interface QuickReport {
  address: string;
  portfolio: PortfolioData;
  topPositions: Position[];
}

export interface PnlReport {
  address: string;
  pnl: PnlData;
  roi: number;
}

export interface DefiReport {
  address: string;
  positions: DefiPosition[];
  totalDefiUsd: number;
}

export interface HistoryReport {
  address: string;
  transactions: Transaction[];
  pattern: { trades: number; receives: number; sends: number; executes: number; other: number };
  frequency: string;
}

export interface NftReport {
  address: string;
  collections: NftCollection[];
  totalEstimatedUsd: number;
}

export interface CompareReport {
  addressA: string;
  addressB: string;
  a: { portfolio: PortfolioData; positions: Position[]; pnl: PnlData };
  b: { portfolio: PortfolioData; positions: Position[]; pnl: PnlData };
  verdict: string;
}
