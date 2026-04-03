import { PORTS } from "@wire/shared/config";

async function bootstrap(): Promise<void> {
  console.log("Bootstrapping wire group...\n");

  const agents = ["scanner", "enricher", "analyst", "distributor", "trader"] as const;

  // Wait for all agents to be online
  for (const agent of agents) {
    const port = PORTS[agent];
    let attempts = 0;
    while (attempts < 30) {
      try {
        const res = await fetch(`http://localhost:${port}/health`);
        if (res.ok) {
          console.log(`  ${agent}: online (port ${port})`);
          break;
        }
      } catch {
        // not ready yet
      }
      attempts++;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (attempts >= 30) {
      console.error(`  ${agent}: FAILED to connect on port ${port}`);
      process.exit(1);
    }
  }

  // Generate a group ID (no XMTP agent needed)
  const groupId = `wire-group-${Date.now()}`;
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
