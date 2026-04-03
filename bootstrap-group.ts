import { createWireAgent, createGroup } from "@wire/shared/xmtp";
import { PORTS } from "@wire/shared/config";

async function bootstrap(): Promise<void> {
  console.log("Bootstrapping XMTP group...\n");

  const agents = ["scanner", "enricher", "analyst", "distributor", "trader"] as const;
  const addresses: Record<string, string> = {};

  for (const agent of agents) {
    const port = PORTS[agent];
    let attempts = 0;
    while (attempts < 30) {
      try {
        const res = await fetch(`http://localhost:${port}/address`);
        const { address } = await res.json() as { address: string };
        addresses[agent] = address;
        console.log(`  ${agent}: ${address}`);
        break;
      } catch {
        attempts++;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!addresses[agent]) {
      console.error(`  ${agent}: FAILED to connect on port ${port}`);
      process.exit(1);
    }
  }

  // Scanner creates the group
  const scanner = await createWireAgent("scanner");
  const memberAddresses = Object.entries(addresses)
    .filter(([name]) => name !== "scanner")
    .map(([, addr]) => addr);

  const groupId = await createGroup(scanner, memberAddresses);
  console.log(`\nGroup created: ${groupId}\n`);

  // Notify all agents of the group ID
  for (const agent of agents) {
    const port = PORTS[agent];
    try {
      await fetch(`http://localhost:${port}/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      console.log(`  Notified ${agent} of group ID`);
    } catch (err) {
      console.error(`  Failed to notify ${agent}:`, err);
    }
  }

  console.log("\nBootstrap complete. Intelligence Wire is live.");
}

bootstrap().catch(console.error);
