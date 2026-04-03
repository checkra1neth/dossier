import { generatePrivateKey } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const agents = ["SCANNER", "ENRICHER", "ANALYST", "DISTRIBUTOR", "TRADER"];

let env = existsSync(".env") ? readFileSync(".env", "utf-8") : readFileSync(".env.example", "utf-8");

for (const agent of agents) {
  const walletKeyVar = `${agent}_WALLET_KEY=`;
  const dbKeyVar = `${agent}_DB_KEY=`;

  if (env.includes(`${walletKeyVar}\n`) || env.includes(`${walletKeyVar}$`)) {
    const walletKey = generatePrivateKey();
    env = env.replace(new RegExp(`${walletKeyVar}.*`), `${walletKeyVar}${walletKey}`);
  }

  if (env.includes(`${dbKeyVar}\n`) || env.includes(`${dbKeyVar}$`)) {
    const dbKey = "0x" + randomBytes(32).toString("hex");
    env = env.replace(new RegExp(`${dbKeyVar}.*`), `${dbKeyVar}${dbKey}`);
  }
}

writeFileSync(".env", env);
console.log("Generated wallet keys and DB encryption keys for all 5 agents.");
console.log("Saved to .env");
