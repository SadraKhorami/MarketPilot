import { randomUUID } from "node:crypto";
import { AIError } from "@marketpilot/ai";
import {
  BotProviderError,
  botConfiguration,
  botProviders,
  decryptPayload,
  editDiscordResponse,
  encryptPayload,
  plainText,
  sendTelegram,
  splitText,
  startTelegramTyping,
} from "@marketpilot/bots";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { DatabaseService } from "../database.module";
import { CommandPayloadSchema } from "./bot-command.schema";
import { BotCommandsService } from "./bot-commands.service";
import { BotRepliesService } from "./bot-replies.service";

const ResultSchema = z.object({
  text: z.string(),
  ownerId: z.string().uuid().nullable(),
  linkedAt: z.string().nullable(),
});
@Injectable()
export class BotCommandProcessorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly commands: BotCommandsService,
    private readonly replies: BotRepliesService,
  ) {}
  async process(id: string, shutdown: AbortSignal) {
    const leaseOwner = randomUUID();
    const claim = await this.db.botCommand.updateMany({
      where: {
        id,
        status: { in: ["pending", "processing", "ready", "sending"] },
        expiresAt: { gt: new Date() },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: { leaseOwner, leaseUntil: new Date(Date.now() + 300000) },
    });
    if (!claim.count) return;
    try {
      await this.processClaimed(id, shutdown);
    } finally {
      await this.db.botCommand.updateMany({ where: { id, leaseOwner }, data: { leaseOwner: null, leaseUntil: null } });
    }
  }
  private async processClaimed(id: string, shutdown: AbortSignal) {
    let row = await this.db.botCommand.findUnique({ where: { id } });
    if (
      !row ||
      !["pending", "processing", "ready", "sending"].includes(row.status) ||
      row.expiresAt <= new Date() ||
      row.nextAttemptAt > new Date()
    )
      return;
    const channelProvider = row.provider;
    const provider = botProviders.find((item) => item === channelProvider);
    if (!provider || !botConfiguration(provider).configured) throw new Error("PROVIDER_NOT_CONFIGURED");
    if (row.status !== "sending" && row.replyAttempts >= 5) {
      await this.db.botCommand.update({
        where: { id },
        data: { status: "failed", failureCode: "REPLY_ATTEMPTS_EXHAUSTED" },
      });
      return;
    }
    const payload = CommandPayloadSchema.parse(decryptPayload(row.payload));
    if (row.status === "sending" && provider === "TELEGRAM") {
      await this.db.botCommand.update({
        where: { id },
        data: { status: "unknown", failureCode: "PROVIDER_ACCEPTANCE_UNKNOWN" },
      });
      return;
    }
    if (!row.result) {
      await this.db.botCommand.update({ where: { id }, data: { status: "processing" } });
      const cancel = new AbortController();
      const linked = await this.commands.owner(provider, payload.identity);
      const requestId = row.requestId;
      const conversationId = row.conversationId;
      const expiresAt = row.expiresAt.getTime();
      const checkOwner = setInterval(() => {
        if (!linked) return;
        void this.commands
          .owner(provider, payload.identity)
          .then((current) => {
            if (current?.userId !== linked.userId || current.verifiedAt?.getTime() !== linked.verifiedAt?.getTime())
              cancel.abort();
          })
          .catch(() => cancel.abort());
      }, 2000);
      const processingSignal = AbortSignal.any([
        cancel.signal,
        shutdown,
        AbortSignal.timeout(Math.max(1, Math.min(90000, expiresAt - Date.now() - 1000))),
      ]);
      const stopTyping =
        provider === "TELEGRAM" && linked && ["price", "market", "analyze", "ask"].includes(payload.command)
          ? startTelegramTyping(payload.identity, processingSignal)
          : undefined;
      let result: z.infer<typeof ResultSchema>;
      try {
        result = await this.commands.execute(provider, payload, requestId, conversationId, processingSignal);
      } catch (error) {
        const code =
          error instanceof AIError
            ? error.code
            : error instanceof Error && /^COMMAND_[A-Z_]+$/.test(error.message)
              ? error.message
              : "COMMAND_UNAVAILABLE";
        result = {
          text: commandError(code),
          ownerId: linked?.userId ?? null,
          linkedAt: linked?.verifiedAt?.toISOString() ?? null,
        };
      } finally {
        stopTyping?.();
        clearInterval(checkOwner);
      }
      row = await this.db.botCommand.update({
        where: { id },
        data: { result: encryptPayload(result), status: "ready" },
      });
    }
    const result = ResultSchema.parse(decryptPayload(row.result ?? ""));
    if (result.ownerId) {
      const owner = await this.commands.owner(provider, payload.identity);
      if (owner?.userId !== result.ownerId || owner.verifiedAt?.toISOString() !== result.linkedAt) {
        await this.db.botCommand.update({
          where: { id },
          data: { status: "suppressed", result: null, failureCode: "ACCOUNT_DISCONNECTED" },
        });
        return;
      }
    }
    try {
      if (provider === "DISCORD") {
        if (!payload.replyToken) throw new Error("COMMAND_REPLY_UNAVAILABLE");
        await this.db.botCommand.update({ where: { id }, data: { replyAttempts: { increment: 1 } } });
        const replyToken = payload.replyToken;
        const sent = await this.replies.send(provider, payload.identity, result, () =>
          editDiscordResponse(replyToken, result.text),
        );
        if (!sent) {
          await this.suppress(id);
          return;
        }
      } else {
        const parts = splitText(result.text, 3900);
        for (let index = row.replyIndex; index < parts.length; index++) {
          // A durable intent before each send prevents automatic replay of ambiguous Telegram acceptance.
          await this.db.botCommand.update({
            where: { id },
            data: { status: "sending", sendingAt: new Date(), replyAttempts: { increment: 1 } },
          });
          const sent = await this.replies.send(provider, payload.identity, result, () =>
            sendTelegram(payload.identity, parts[index]),
          );
          if (!sent) {
            await this.suppress(id);
            return;
          }
          await this.db.botCommand.update({
            where: { id },
            data: { status: "ready", replyIndex: index + 1, replyAttempts: 0 },
          });
          if (index + 1 < parts.length) await new Promise<void>((resolve) => setTimeout(resolve, 1100));
        }
      }
      await this.db.botCommand.update({
        where: { id },
        data: { status: "completed", result: null, failureCode: null },
      });
      await this.db.botRuntime.upsert({
        where: { provider },
        create: { provider, checkedAt: new Date(), successfulAt: new Date() },
        update: { checkedAt: new Date(), successfulAt: new Date(), failureCode: null },
      });
    } catch (error) {
      const safe =
        error instanceof BotProviderError ? error : new BotProviderError("COMMAND_REPLY_UNAVAILABLE", null, true);
      const terminal = [
        "DESTINATION_UNAVAILABLE",
        "PROVIDER_REQUEST_REJECTED",
        "PROVIDER_CREDENTIAL_INVALID",
        "COMMAND_REPLY_UNAVAILABLE",
      ].includes(safe.code);
      await this.db.botCommand.update({
        where: { id },
        data: {
          status: provider === "TELEGRAM" && safe.uncertain ? "unknown" : terminal ? "failed" : "ready",
          failureCode: safe.code,
          nextAttemptAt: new Date(Date.now() + (safe.retryAfterMs ?? 5000)),
        },
      });
      await this.db.botRuntime.upsert({
        where: { provider },
        create: { provider, checkedAt: new Date(), failureCode: safe.code },
        update: { checkedAt: new Date(), failureCode: safe.code },
      });
    }
  }
  private async suppress(id: string) {
    await this.db.botCommand.update({
      where: { id },
      data: { status: "suppressed", result: null, failureCode: "ACCOUNT_DISCONNECTED" },
    });
  }
}
function commandError(code: string) {
  const messages: Record<string, string> = {
    COMMAND_OBSERVATION_INVALID: "This market observation could not be verified. Try again shortly.",
    COMMAND_PAGE_INVALID: "Use a positive page number, for example /alerts 2.",
    COMMAND_ARGUMENT_REQUIRED: "Enter a symbol for /analyze or a question for /ask.",
    COMMAND_SYMBOL_REQUIRED: "Enter a catalog symbol, for example BTC-USD or XAU-USD.",
    COMMAND_SYMBOL_AMBIGUOUS: "Use the full symbol including its quote currency.",
    COMMAND_SYMBOL_UNAVAILABLE: "This asset is unavailable in the current catalog. Check Markets in your dashboard.",
    AI_NOT_CONFIGURED: "AI research is not configured. Ask an administrator to configure the research provider.",
    AI_BUSY: "Another research request is running. Try again shortly.",
    AI_RATE_LIMITED: "Too many research requests. Try again shortly.",
    AI_DAILY_BUDGET: "The daily research budget has been reached.",
  };
  return plainText(messages[code] ?? `This request could not be completed (${code}). Try again or check MarketPilot.`);
}
