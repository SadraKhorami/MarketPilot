import { createHash } from "node:crypto";
import type { BotProvider } from "./config";
import { BotProviderError } from "./transport";
export async function reserveSendSlot(
  provider: BotProvider,
  identity: string,
  evaluate: (script: string, key: string) => Promise<unknown>,
) {
  const key = `marketpilot:bot-send:${provider}:${createHash("sha256").update(identity).digest("hex")}`;
  const wait = Number(
    await evaluate(
      "local t=redis.call('PTTL',KEYS[1]); if t>0 then return t end; redis.call('SET',KEYS[1],'1','PX',1100); return 0",
      key,
    ),
  );
  if (wait > 0) throw new BotProviderError("PROVIDER_RATE_LIMITED", wait);
}
