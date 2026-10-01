import { z } from "zod";
import { type BotProvider, botConfiguration } from "./config";
import { discordPresentation, telegramHtml } from "./presentation";
import { plainText, splitText } from "./security";
export class BotProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterMs: number | null = null,
    readonly uncertain = false,
  ) {
    super(code);
  }
}
const receipt = z.object({ id: z.string().regex(/^\d{1,20}$/) });
const telegramEnvelope = z.object({
  ok: z.boolean(),
  error_code: z.number().optional(),
  parameters: z.object({ retry_after: z.number().positive().optional() }).optional(),
  result: z.unknown().optional(),
});
async function request(url: string, init: RequestInit, telegram = false, mutation = true): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new BotProviderError("PROVIDER_NETWORK", null, mutation);
  }
  let data: unknown = null;
  let parsedBody = false;
  try {
    data = await readJson(response);
    parsedBody = true;
  } catch {
    parsedBody = false;
  }
  const tg = telegram ? telegramEnvelope.safeParse(data) : null;
  const code = tg?.success && !tg.data.ok ? (tg.data.error_code ?? response.status) : response.status;
  if (code === 429) {
    const seconds = tg?.success
      ? tg.data.parameters?.retry_after
      : z.object({ retry_after: z.number().positive() }).safeParse(data).data?.retry_after;
    throw new BotProviderError("PROVIDER_RATE_LIMITED", Math.max(1000, (seconds ?? 60) * 1000));
  }
  if (code === 401) throw new BotProviderError("PROVIDER_CREDENTIAL_INVALID");
  if (code === 403 || code === 404) throw new BotProviderError("DESTINATION_UNAVAILABLE");
  if (code >= 500) throw new BotProviderError("PROVIDER_UNAVAILABLE", null, mutation);
  if (!response.ok || (tg?.success && !tg.data.ok)) throw new BotProviderError("PROVIDER_REQUEST_REJECTED");
  if (!parsedBody) throw new BotProviderError("PROVIDER_RESPONSE_INVALID", null, mutation);
  if (telegram && !tg?.success) throw new BotProviderError("PROVIDER_RESPONSE_INVALID", null, mutation);
  return tg?.success ? tg.data.result : data;
}
export function telegramRequest(method: string, body: unknown, mutation = true) {
  return request(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    true,
    mutation,
  );
}
export function discordRequest(path: string, method: string, body?: unknown, authenticated = true, mutation = true) {
  return request(
    `https://discord.com/api/v10/${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    },
    false,
    mutation,
  );
}
export async function sendTelegram(destination: string, text: string) {
  const result = await telegramRequest("sendMessage", {
    chat_id: destination,
    text: telegramHtml(splitText(plainText(text), 3900, 1)[0] ?? ""),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    protect_content: true,
  });
  const parsed = z.object({ message_id: z.number().int().positive() }).safeParse(result);
  if (!parsed.success) throw new BotProviderError("PROVIDER_RECEIPT_INVALID", null, true);
  return String(parsed.data.message_id);
}
export async function sendDiscordAlert(destination: string, text: string, nonce: string) {
  const channel = receipt.parse(
    await discordRequest("users/@me/channels", "POST", { recipient_id: destination }, true, false),
  );
  const parsed = receipt.safeParse(
    await discordRequest(`channels/${channel.id}/messages`, "POST", {
      ...discordPresentation(text),
      nonce,
      enforce_nonce: true,
    }),
  );
  if (!parsed.success) throw new BotProviderError("PROVIDER_RECEIPT_INVALID", null, true);
  return parsed.data.id;
}
export async function editDiscordResponse(token: string, text: string) {
  return discordRequest(
    `webhooks/${process.env.DISCORD_APPLICATION_ID}/${encodeURIComponent(token)}/messages/@original`,
    "PATCH",
    discordPresentation(text),
    false,
  );
}
export async function sendAlert(provider: BotProvider, destination: string, text: string, deliveryId: string) {
  if (!botConfiguration(provider).configured) throw new BotProviderError("PROVIDER_NOT_CONFIGURED", 60000);
  if (provider === "TELEGRAM") return sendTelegram(destination, text);
  const nonce = BigInt(`0x${deliveryId.replaceAll("-", "").slice(0, 16)}`).toString();
  return sendDiscordAlert(destination, text, nonce);
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        throw new Error("RESPONSE_TOO_LARGE");
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

export function startTelegramTyping(destination: string, signal: AbortSignal) {
  let stopped = false;
  let sending = false;
  const update = async () => {
    if (stopped || signal.aborted || sending) return;
    sending = true;
    try {
      await telegramRequest("sendChatAction", { chat_id: destination, action: "typing" }, false);
    } catch {
      /* A transient activity indicator must not fail the actual response. */
    } finally {
      sending = false;
    }
  };
  const stop = () => {
    stopped = true;
    clearInterval(timer);
    signal.removeEventListener("abort", stop);
  };
  const timer = setInterval(() => void update(), 4000);
  signal.addEventListener("abort", stop, { once: true });
  void update();
  return stop;
}
