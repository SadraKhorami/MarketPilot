import { z } from "zod";
import { botConfiguration, botProviders } from "./config";
import { BotProviderError, discordRequest, telegramRequest } from "./transport";

async function setup() {
  const provider = botProviders.find((item) => item.toLowerCase() === process.argv[2]?.toLowerCase());
  if (!provider) throw new Error("Use: pnpm bots:setup telegram|discord");
  const config = botConfiguration(provider);
  if (!config.configured)
    throw new Error(`Missing/invalid configuration names: ${[...config.missing, ...config.invalid].join(", ")}`);
  const api = new URL(process.env.BOT_API_URL ?? "");
  if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash)
    throw new Error("BOT_API_URL must be a public HTTPS API base URL, such as https://api.example.com/api/v1");
  const base = api.toString().replace(/\/$/, "");
  if (provider === "TELEGRAM") {
    const identity = z
      .object({ is_bot: z.literal(true), username: z.string() })
      .parse(await telegramRequest("getMe", {}, false));
    if (identity.username.toLowerCase() !== process.env.TELEGRAM_BOT_USERNAME?.toLowerCase())
      throw new BotProviderError("PROVIDER_IDENTITY_MISMATCH");
    await telegramRequest("setMyCommands", {
      commands: [
        { command: "start", description: "Link your MarketPilot account" },
        { command: "help", description: "Commands and linking guidance" },
        { command: "price", description: "Observed market price: /price BTC" },
        { command: "analyze", description: "Sourced AI analysis: /analyze BTC" },
        { command: "ask", description: "Market research question" },
        { command: "watchlist", description: "Your watchlists, optional page number" },
        { command: "alerts", description: "Your saved alerts, optional page number" },
      ],
      scope: { type: "all_private_chats" },
    });
    await telegramRequest("setWebhook", {
      url: `${base}/bot-webhooks/telegram`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message"],
      max_connections: 4,
      drop_pending_updates: false,
    });
    console.log("Telegram private commands and authenticated webhook registered.");
  } else {
    const identity = z
      .object({ id: z.string() })
      .parse(await discordRequest("applications/@me", "GET", undefined, true, false));
    if (identity.id !== process.env.DISCORD_APPLICATION_ID) throw new BotProviderError("PROVIDER_IDENTITY_MISMATCH");
    const commands = [
      { name: "help", description: "MarketPilot commands and linking guidance" },
      {
        name: "link",
        description: "Link your MarketPilot account in private DM",
        contexts: [1],
        options: [
          {
            name: "code",
            description: "One-time code from the MarketPilot dashboard",
            type: 3,
            required: true,
            min_length: 43,
            max_length: 43,
          },
        ],
      },
      ...["market", "price", "analyze"].map((name) => ({
        name,
        description: name === "analyze" ? "Sourced AI market analysis" : "Observed market price",
        options: [
          {
            name: "symbol",
            description: "Catalog symbol or alias, such as BTC or XAU-USD",
            type: 3,
            required: true,
            max_length: 80,
          },
        ],
      })),
      {
        name: "ask",
        description: "Ask a sourced market research question",
        options: [{ name: "question", description: "Your market question", type: 3, required: true, max_length: 2000 }],
      },
      ...["watchlist", "alerts"].map((name) => ({
        name,
        description: `Your private MarketPilot ${name}`,
        options: [
          { name: "page", description: "Page number", type: 4, required: false, min_value: 1, max_value: 10000 },
        ],
      })),
    ];
    for (const command of commands)
      await discordRequest(`applications/${process.env.DISCORD_APPLICATION_ID}/commands`, "POST", {
        type: 1,
        integration_types: [0],
        contexts: [0, 1],
        ...command,
      });
    console.log(
      `Discord commands registered. Set the application's Interactions Endpoint URL to ${base}/bot-webhooks/discord in the Developer Portal, then install the bot. /link is available only in the bot's DM.`,
    );
  }
}
void setup().catch((error: unknown) => {
  // Never include provider raw bodies, URLs with tokens, or fetch exception text.
  console.error(
    error instanceof BotProviderError
      ? error.code
      : error instanceof Error && /^(Use:|Missing\/invalid configuration names:|BOT_API_URL)/.test(error.message)
        ? error.message
        : "Bot setup failed. Check server configuration and provider connectivity.",
  );
  process.exitCode = 1;
});
