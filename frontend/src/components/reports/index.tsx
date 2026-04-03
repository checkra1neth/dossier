import type { ReactNode } from "react";
import type { Command } from "../../api";
import { ResearchReport } from "./ResearchReport";
import { QuickReport } from "./QuickReport";
import { PnlReport } from "./PnlReport";
import { DefiReport } from "./DefiReport";
import { HistoryReport } from "./HistoryReport";
import { NftReport } from "./NftReport";
import { CompareReport } from "./CompareReport";
import { BalanceReport } from "./BalanceReport";
import { SwapReport } from "./SwapReport";
import { BridgeReport } from "./BridgeReport";
import { SendReport } from "./SendReport";
import { WatchReport } from "./WatchReport";
import { UnwatchReport } from "./UnwatchReport";

interface Props {
  command: Command;
  data: unknown;
}

export function ReportView({ command, data }: Props): ReactNode {
  switch (command) {
    case "research":
      return <ResearchReport data={data as Parameters<typeof ResearchReport>[0]["data"]} />;
    case "quick":
      return <QuickReport data={data as Parameters<typeof QuickReport>[0]["data"]} />;
    case "pnl":
      return <PnlReport data={data as Parameters<typeof PnlReport>[0]["data"]} />;
    case "defi":
      return <DefiReport data={data as Parameters<typeof DefiReport>[0]["data"]} />;
    case "history":
      return <HistoryReport data={data as Parameters<typeof HistoryReport>[0]["data"]} />;
    case "nft":
      return <NftReport data={data as Parameters<typeof NftReport>[0]["data"]} />;
    case "compare":
      return <CompareReport data={data as Parameters<typeof CompareReport>[0]["data"]} />;
    case "balance":
      return <BalanceReport data={data as Parameters<typeof BalanceReport>[0]["data"]} />;
    case "swap":
      return <SwapReport data={data as Parameters<typeof SwapReport>[0]["data"]} />;
    case "bridge":
      return <BridgeReport data={data as Parameters<typeof BridgeReport>[0]["data"]} />;
    case "send":
      return <SendReport data={data as Parameters<typeof SendReport>[0]["data"]} />;
    case "watch":
      return <WatchReport data={data as Parameters<typeof WatchReport>[0]["data"]} />;
    case "unwatch":
      return <UnwatchReport data={data as Parameters<typeof UnwatchReport>[0]["data"]} />;
    default:
      return null;
  }
}
