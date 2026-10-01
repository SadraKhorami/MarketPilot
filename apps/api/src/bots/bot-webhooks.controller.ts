import { botConfiguration, validDiscordSignature, validTelegramSecret } from "@marketpilot/bots";
import {
  Body,
  Controller,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../common/auth";
import { CommandPayloadSchema, DiscordInteractionSchema, TelegramUpdateSchema } from "./bot-command.schema";
import { BotRuntimeService } from "./bot-runtime.service";
@Public()
@Controller("bot-webhooks")
export class BotWebhooksController {
  constructor(private readonly runtime: BotRuntimeService) {}
  @Post("telegram")
  @HttpCode(200)
  async telegram(@Req() request: Request, @Body() body: unknown) {
    if (!validTelegramSecret(request.get("X-Telegram-Bot-Api-Secret-Token")))
      throw new UnauthorizedException("Invalid webhook authentication.");
    if (!botConfiguration("TELEGRAM").configured) throw new ServiceUnavailableException("Bot unavailable.");
    const update = TelegramUpdateSchema.safeParse(body);
    if (!update.success) return { ok: true };
    const message = update.data.message;
    if (
      !message?.from ||
      message.from.is_bot ||
      message.chat.type !== "private" ||
      message.chat.id !== message.from.id ||
      !message.text ||
      Math.abs(Date.now() / 1000 - message.date) > 600
    )
      return { ok: true };
    const match = message.text.match(/^\/([a-z]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
    if (match?.[2] && match[2].toLowerCase() !== process.env.TELEGRAM_BOT_USERNAME?.toLowerCase()) return { ok: true };
    const requested = match ? match[1].toLowerCase() : "ask";
    const command = CommandPayloadSchema.shape.command.safeParse(requested).success ? requested : "help";
    const parsed = CommandPayloadSchema.safeParse({
      identity: String(message.from.id),
      name: (message.from.username ? `@${message.from.username}` : message.from.first_name).slice(0, 120),
      command,
      argument: (match ? (match[3] ?? "") : message.text).trim().slice(0, 2000),
    });
    if (!parsed.success) return { ok: true };
    await this.runtime.accept("TELEGRAM", String(update.data.update_id), parsed.data);
    return { ok: true };
  }
  @Post("discord")
  @HttpCode(200)
  async discord(@Req() request: RawBodyRequest<Request>, @Body() body: unknown, @Res() response: Response) {
    if (
      !request.rawBody ||
      !validDiscordSignature(request.rawBody, request.get("X-Signature-Ed25519"), request.get("X-Signature-Timestamp"))
    )
      throw new UnauthorizedException("Invalid interaction signature.");
    if (!botConfiguration("DISCORD").configured) throw new ServiceUnavailableException("Bot unavailable.");
    const interaction = DiscordInteractionSchema.safeParse(body);
    if (!interaction.success || interaction.data.application_id !== process.env.DISCORD_APPLICATION_ID)
      throw new UnauthorizedException("Invalid application interaction.");
    if (interaction.data.type === 1) {
      response.json({ type: 1 });
      return;
    }
    const source = interaction.data;
    const sender = source.member?.user ?? source.user;
    const payload = CommandPayloadSchema.safeParse({
      identity: sender?.id,
      name: sender?.username.slice(0, 120),
      command: source.data?.name,
      argument: String(source.data?.options?.[0]?.value ?? ""),
      replyToken: source.token,
    });
    if (source.type !== 2 || !sender || sender.bot || !payload.success) {
      response.json({
        type: 4,
        data: { flags: 64, content: "Use a supported MarketPilot command.", allowed_mentions: { parse: [] } },
      });
      return;
    }
    if (payload.data.command === "link" && (source.guild_id || source.member)) {
      response.json({
        type: 4,
        data: {
          flags: 64,
          content: "Use /link in a private DM with the MarketPilot bot.",
          allowed_mentions: { parse: [] },
        },
      });
      return;
    }
    // Bound the durable acceptance path to leave time for Discord's three-second acknowledgement.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.runtime.accept("DISCORD", source.id, payload.data),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("ACCEPT_TIMEOUT")), 1500);
        }),
      ]);
      response.json({ type: 5, data: { flags: 64 } });
    } catch {
      response.json({
        type: 4,
        data: {
          flags: 64,
          content: "MarketPilot is busy or unavailable. Try again shortly.",
          allowed_mentions: { parse: [] },
        },
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
