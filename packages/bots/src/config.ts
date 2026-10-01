export const botProviders = ["TELEGRAM", "DISCORD"] as const;
export type BotProvider = (typeof botProviders)[number];
export function botConfiguration(provider: BotProvider) {
  const required =
    provider === "TELEGRAM"
      ? ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME", "TELEGRAM_WEBHOOK_SECRET", "BOT_PAYLOAD_KEY", "BOT_WEB_URL"]
      : ["DISCORD_BOT_TOKEN", "DISCORD_APPLICATION_ID", "DISCORD_PUBLIC_KEY", "BOT_PAYLOAD_KEY", "BOT_WEB_URL"];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const invalid: string[] = [];
  if (process.env.BOT_PAYLOAD_KEY && !/^[a-fA-F0-9]{64}$/.test(process.env.BOT_PAYLOAD_KEY))
    invalid.push("BOT_PAYLOAD_KEY");
  if (process.env.BOT_WEB_URL) {
    try {
      const url = new URL(process.env.BOT_WEB_URL);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        (url.protocol !== "https:" &&
          !(
            process.env.NODE_ENV !== "production" &&
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(url.hostname)
          ))
      )
        invalid.push("BOT_WEB_URL");
    } catch {
      invalid.push("BOT_WEB_URL");
    }
  }
  if (provider === "TELEGRAM") {
    if (process.env.TELEGRAM_BOT_USERNAME && !/^[A-Za-z0-9_]{5,32}$/.test(process.env.TELEGRAM_BOT_USERNAME))
      invalid.push("TELEGRAM_BOT_USERNAME");
    if (process.env.TELEGRAM_WEBHOOK_SECRET && !/^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET))
      invalid.push("TELEGRAM_WEBHOOK_SECRET");
  } else {
    if (process.env.DISCORD_APPLICATION_ID && !/^\d{17,20}$/.test(process.env.DISCORD_APPLICATION_ID))
      invalid.push("DISCORD_APPLICATION_ID");
    if (process.env.DISCORD_PUBLIC_KEY && !/^[a-fA-F0-9]{64}$/.test(process.env.DISCORD_PUBLIC_KEY))
      invalid.push("DISCORD_PUBLIC_KEY");
  }
  return { provider, configured: missing.length === 0 && invalid.length === 0, missing, invalid };
}
export function dashboardUrl(path = "/dashboard/bots/telegram") {
  return new URL(path, process.env.BOT_WEB_URL ?? "http://localhost:3000").toString();
}
