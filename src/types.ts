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
