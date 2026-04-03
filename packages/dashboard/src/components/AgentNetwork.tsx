import { useMemo } from "react";
import type { WireEvent } from "../hooks/useSSE";

interface Props {
  events: WireEvent[];
}

const AGENTS = [
  { name: "scanner", abbr: "SCN", color: "#3b82f6", cx: 80, cy: 100 },
  { name: "enricher", abbr: "ENR", color: "#a855f7", cx: 220, cy: 50 },
  { name: "analyst", abbr: "ANL", color: "#eab308", cx: 360, cy: 100 },
  { name: "distributor", abbr: "DST", color: "#22c55e", cx: 500, cy: 50 },
  { name: "trader", abbr: "TRD", color: "#ef4444", cx: 500, cy: 170 },
] as const;

const EDGES: [number, number][] = [
  [0, 1], // scanner -> enricher
  [1, 2], // enricher -> analyst
  [2, 3], // analyst -> distributor
  [2, 4], // analyst -> trader
];

export function AgentNetwork({ events }: Props): JSX.Element {
  const now = Date.now();
  const activeAgents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (now - e.timestamp < 30_000) set.add(e.agent);
    }
    return set;
  }, [events, now]);

  return (
    <div className="panel">
      <h2 className="panel-title">Agent Network</h2>
      <svg viewBox="0 0 580 220" className="agent-svg">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#444" />
          </marker>
        </defs>

        {EDGES.map(([from, to], i) => (
          <line
            key={i}
            x1={AGENTS[from].cx}
            y1={AGENTS[from].cy}
            x2={AGENTS[to].cx}
            y2={AGENTS[to].cy}
            stroke="#333"
            strokeWidth="2"
            markerEnd="url(#arrow)"
          />
        ))}

        {AGENTS.map((a) => {
          const active = activeAgents.has(a.name);
          return (
            <g key={a.name}>
              {active && (
                <circle
                  cx={a.cx}
                  cy={a.cy}
                  r="32"
                  fill="none"
                  stroke={a.color}
                  strokeWidth="2"
                  opacity="0.4"
                  className="pulse-ring"
                />
              )}
              <circle
                cx={a.cx}
                cy={a.cy}
                r="26"
                fill={active ? a.color : "#222"}
                stroke={a.color}
                strokeWidth="2"
                opacity={active ? 1 : 0.5}
              />
              <text
                x={a.cx}
                y={a.cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={active ? "#000" : "#888"}
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {a.abbr}
              </text>
              <text
                x={a.cx}
                y={a.cy + 42}
                textAnchor="middle"
                fill="#666"
                fontSize="10"
                fontFamily="monospace"
              >
                {a.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
