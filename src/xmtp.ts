import { Agent, CommandRouter, createUser, createSigner } from "@xmtp/agent-sdk";
import { research } from "./pipeline.ts";
import { reportToMarkdown } from "./report.ts";

export async function startXmtpAgent(): Promise<Agent> {
  const walletKey = process.env.WALLET_KEY as `0x${string}`;
  if (!walletKey) throw new Error("WALLET_KEY is not set");

  const dbKeyHex = process.env.DB_ENCRYPTION_KEY;
  const dbEncryptionKey = dbKeyHex
    ? new Uint8Array(Buffer.from(dbKeyHex.startsWith("0x") ? dbKeyHex.slice(2) : dbKeyHex, "hex"))
    : undefined;

  const xmtpEnv = (process.env.XMTP_ENV || "dev") as "dev" | "production";

  const user = createUser(walletKey);
  const signer = createSigner(user);
  const agent = await Agent.create(signer, {
    env: xmtpEnv,
    dbEncryptionKey,
  });

  const router = new CommandRouter({ helpCommand: "/help" });

  router.command("/research", "Research a wallet address", async (ctx) => {
    const text = ctx.message.content as string;
    const parts = text.trim().split(/\s+/);
    const address = parts[1];

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      await ctx.conversation.sendText("Usage: /research 0x<address>\n\nProvide a valid Ethereum address.");
      return;
    }

    await ctx.conversation.sendText("🔍 Researching wallet... This may take 10-20 seconds.");

    try {
      const report = await research(address);
      const markdown = reportToMarkdown(report);
      await ctx.conversation.sendText(markdown);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.conversation.sendText(`❌ Research failed: ${msg}`);
    }
  });

  router.default(async (ctx) => {
    await ctx.conversation.sendText(
      "👋 **OWS Deep Research Service**\n\n" +
      "Send `/research 0x<address>` to analyze any wallet.\n\n" +
      "I'll fetch portfolio data, analyze positions, and give you a comprehensive report."
    );
  });

  agent.use(router.middleware());

  await agent.start();
  console.log(`[xmtp] Agent online: ${agent.address}`);

  return agent;
}
