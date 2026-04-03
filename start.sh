#!/bin/bash
set -e

echo "=== Intelligence Wire ==="
echo "Starting 5 agents + dashboard..."
echo ""

# Start all agents and dashboard in parallel
npx concurrently \
  --names "SCAN,ENRICH,ANALYST,DISTRIB,TRADE,DASH" \
  --prefix-colors "blue,magenta,yellow,green,red,cyan" \
  "npx tsx packages/scanner/src/index.ts" \
  "npx tsx packages/enricher/src/index.ts" \
  "npx tsx packages/analyst/src/index.ts" \
  "npx tsx packages/distributor/src/index.ts" \
  "npx tsx packages/trader/src/index.ts" \
  "npx vite packages/dashboard --port 3000" &

PIDS=$!

# Wait for agents to start
echo "Waiting for agents to boot (15s)..."
sleep 15

# Bootstrap XMTP group
echo "Bootstrapping XMTP group..."
npx tsx bootstrap-group.ts

echo ""
echo "=== All systems operational ==="
echo "Dashboard:    http://localhost:3000"
echo "Scanner:      http://localhost:4001"
echo "Enricher:     http://localhost:4002"
echo "Analyst:      http://localhost:4003 (x402 paid)"
echo "Distributor:  http://localhost:4004"
echo "Trader:       http://localhost:4005"

# Keep alive
wait $PIDS
