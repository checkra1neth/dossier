import { useSSE } from "./hooks/useSSE";
import { AgentNetwork } from "./components/AgentNetwork";
import { LiveFeed } from "./components/LiveFeed";
import { Signals } from "./components/Signals";
import { TradingActivity } from "./components/TradingActivity";

export function App(): JSX.Element {
  const { events, getSignals, getTrades } = useSSE();

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Intelligence Wire</h1>
        <p className="subtitle">
          OWS Hackathon — 5 Agents, 9 Partners, Real-Time On-Chain Intelligence
        </p>
      </header>

      <div className="grid">
        <AgentNetwork events={events} />
        <LiveFeed events={events} />
        <Signals signals={getSignals()} />
        <TradingActivity trades={getTrades()} />
      </div>
    </div>
  );
}
