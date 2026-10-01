import { AIError, type ResearchResult } from "@marketpilot/ai";
import { type BotProvider, dashboardUrl } from "@marketpilot/bots";
import { assetSearchTerms } from "@marketpilot/market-data";
import { Injectable } from "@nestjs/common";
import { AiService } from "../ai/ai.service";
import { DatabaseService } from "../database.module";
import { MarketCatalogService } from "../market-data/market-catalog.service";
import { MarketDataService } from "../market-data/market-data.service";
import type { CommandPayload } from "./bot-command.schema";
import { BotLinksService } from "./bot-links.service";
import { formatBotPrice } from "./bot-market-format";

const pageSize = 8;
@Injectable()
export class BotCommandsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly catalog: MarketCatalogService,
    private readonly market: MarketDataService,
    private readonly links: BotLinksService,
  ) {}
  async owner(provider: BotProvider, identity: string) {
    return this.db.notificationChannel.findFirst({
      where: {
        provider,
        externalAccountId: identity,
        active: true,
        verifiedAt: { not: null },
        user: { status: "ACTIVE" },
      },
      select: { userId: true, verifiedAt: true },
    });
  }
  async execute(
    provider: BotProvider,
    payload: CommandPayload,
    requestId: string,
    conversationId: string,
    signal: AbortSignal,
  ) {
    const { command, argument, identity } = payload;
    const guide = formatGuide(provider);
    if ((command === "start" || command === "link") && argument)
      return {
        text: await this.links.redeem(provider, argument, identity, payload.name),
        ownerId: null,
        linkedAt: null,
      };
    if (["help", "start", "link"].includes(command)) return { text: guide, ownerId: null, linkedAt: null };
    const channel = await this.owner(provider, identity);
    if (!channel) return { text: guide, ownerId: null, linkedAt: null };
    const userId = channel.userId;
    const linkedAt = channel.verifiedAt?.toISOString() ?? null;
    let text: string;
    if (command === "price" || command === "market") {
      const symbol = await this.resolve(argument);
      const snapshot = await this.market.getMarketData(symbol, "15m");
      text = formatBotPrice(snapshot, symbol);
    } else if (command === "watchlist" || command === "alerts") {
      const page = argument ? Number(argument) : 1;
      if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error("COMMAND_PAGE_INVALID");
      if (command === "watchlist") {
        const [items, total] = await Promise.all([
          this.db.watchlist.findMany({
            where: { userId },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { items: { orderBy: { position: "asc" }, take: 30 }, _count: { select: { items: true } } },
          }),
          this.db.watchlist.count({ where: { userId } }),
        ]);
        text = items.length
          ? items
              .map(
                (item) =>
                  `${item.name}: ${item.items.map((asset) => asset.assetId).join(", ") || "No assets"}${item._count.items > 30 ? ` (+${item._count.items - 30} more in dashboard)` : ""}`,
              )
              .join("\n\n")
          : "No watchlists on this page.";
        text = `📋 Your watchlists\n\n${text}`;
        text += `\n\nPage ${page} / ${Math.max(1, Math.ceil(total / pageSize))} · ${total} watchlists\n${dashboardUrl("/dashboard/watchlist")}`;
      } else {
        const [items, total] = await Promise.all([
          this.db.alert.findMany({
            where: { userId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          this.db.alert.count({ where: { userId } }),
        ]);
        text = items.length
          ? items
              .map(
                (item) =>
                  `${item.name} · ${item.assetId}\n${item.condition.replaceAll("_", " ")} ${Number(item.threshold).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${item.condition.startsWith("RSI") ? "index" : item.condition.startsWith("PERCENT") ? "% per candle" : item.assetId.split("-")[1]} · ${item.interval} · ${item.enabled ? "Enabled" : "Paused"}\nLast trigger: ${item.lastTriggeredAt?.toISOString() ?? "None"}`,
              )
              .join("\n\n")
          : "No alerts on this page.";
        text = `🔔 Your alert rules\n\n${text}`;
        text += `\n\nPage ${page} / ${Math.max(1, Math.ceil(total / pageSize))} · ${total} alerts\n${dashboardUrl("/dashboard/alerts")}`;
      }
    } else {
      if (!argument.trim()) throw new Error("COMMAND_ARGUMENT_REQUIRED");
      const input =
        command === "analyze"
          ? `Analyze ${await this.resolve(argument)} using current sourced market observations.`
          : argument;
      let result: ResearchResult | null = null;
      await this.ai.cleanup();
      await this.ai.research(userId, { requestId, conversationId, input }, signal, (event) => {
        if (event.type === "result") result = event.result;
      });
      if (!result) throw new AIError("AI_RESULT_UNAVAILABLE", "Research has no completed result.");
      text = formatResearch(result, conversationId, input);
    }
    return { text, ownerId: userId, linkedAt };
  }
  private async resolve(argument: string) {
    const query = argument.trim().toUpperCase();
    if (!query || query.length > 80) throw new Error("COMMAND_SYMBOL_REQUIRED");
    const { instruments } = await this.catalog.list();
    const alias: Record<string, string> = { GOLD: "XAU-USD", XAU: "XAU-USD", SILVER: "XAG-USD", XAG: "XAG-USD" };
    const exact = instruments.find((item) => item.symbol === (alias[query] ?? query));
    if (exact) return exact.symbol;
    const compact = instruments.filter((item) => item.symbol.replaceAll("-", "") === query);
    if (compact.length === 1) return compact[0].symbol;
    const candidates = instruments.filter((item) =>
      assetSearchTerms(item.symbol, item.name).some((term) => term.toUpperCase() === query),
    );
    const usd = candidates.find((item) => item.symbol.endsWith("-USD"));
    if (usd) return usd.symbol;
    if (candidates.length === 1) return candidates[0].symbol;
    throw new Error(candidates.length ? "COMMAND_SYMBOL_AMBIGUOUS" : "COMMAND_SYMBOL_UNAVAILABLE");
  }
}
function formatResearch(result: ResearchResult, conversationId: string, input: string) {
  const link = dashboardUrl(`/dashboard/ai-analyst?conversation=${conversationId}`);
  const names = ["Summary", "Technical interpretation", "Context & limitations"];
  const sections = result.answer.interpretation.map((item, index) => {
    const citations = item.sourceIds
      .map((id) => result.sources.find((source) => source.id === id))
      .filter((source) => source !== undefined)
      .map((source) => source.title);
    return `${names[index] ?? "Context & limitations"}\n${item.text}${citations.length ? `\n↳ ${[...new Set(citations)].join(" · ")}` : ""}`;
  });
  const sources = [...new Map(result.sources.map((source) => [`${source.title}:${source.source}`, source])).values()];
  return `🔎 AI research\nFull research & evidence: ${link}\n\nResearch request\n${input}\n\n${sections.join("\n\n")}\n\nSources\n${sources
    .slice(0, 6)
    .map(
      (source) =>
        `• ${source.title} · ${source.source}${source.status !== "ok" ? ` · ${source.status === "partial" ? "Limited data" : "Unavailable"}` : ""}${source.freshness === "stale" ? " · Older observation" : ""}`,
    )
    .join(
      "\n",
    )}\n\n${result.proposals.length ? "Review and confirm proposed alert rules in AI Analyst." : "Observed values, timestamps and original sources are available in the full research."}`;
}
function formatGuide(provider: BotProvider) {
  const discord = provider === "DISCORD";
  return `👋 Welcome to MarketPilot\nPrivate market research and saved-rule alerts.\n\nConnect your account\n${dashboardUrl(`/dashboard/bots/${provider.toLowerCase()}`)}\n${discord ? "1. Install MarketPilot, then click the bot’s profile and choose Message.\n2. In that private DM, type /link and select MarketPilot’s slash command. Paste your dashboard code into the code field.\n3. Return to the dashboard and confirm your identity. Do not paste the code into a server channel as a normal message." : "Create a secure link in the dashboard, open the Telegram bot and press Start. Then return to the dashboard to confirm your identity."}\n\nCommands\n${discord ? "/market symbol:BTC" : "/price BTC"} — market snapshot\n${discord ? "/analyze symbol:XAU-USD" : "/analyze XAU-USD"} — sourced research\n${discord ? "/ask question:Your question" : "/ask Your question"} — ask about a market\n${discord ? "/watchlist page:1" : "/watchlist 1"} — your watchlists\n${discord ? "/alerts page:1" : "/alerts 1"} — your saved rules\n\nResearch and account data require a confirmed link. Market alerts are optional; enable them after linking.`;
}
