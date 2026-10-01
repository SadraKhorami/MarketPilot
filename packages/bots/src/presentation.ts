import { discordText, plainText, splitText } from "./security";

const headings = new Set([
  "Summary",
  "Technical interpretation",
  "Context & limitations",
  "Sources",
  "Market snapshot",
  "Commands",
  "Connect your account",
  "Your watchlists",
  "Your alert rules",
  "Next step",
  "Observation",
  "Research request",
]);
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
export function telegramHtml(value: string) {
  return plainText(value)
    .split("\n")
    .map((line, index) => {
      const safe = escapeHtml(line);
      if (index === 0 || headings.has(line)) return `<b>${safe}</b>`;
      if (line.startsWith("/")) return `<code>${safe}</code>`;
      return safe;
    })
    .join("\n");
}
export function discordPresentation(value: string) {
  const [title, ...lines] = plainText(value).split("\n");
  const formatted = lines
    .map((line) => (headings.has(line) ? `**${line}**` : discordText(line)))
    .join("\n")
    .trim();
  const description = splitText(formatted, 3900, 1)[0] ?? "";
  const truncated = formatted.length > description.length;
  return {
    content: "",
    embeds: [
      {
        title: discordText(title).slice(0, 256) || "MarketPilot",
        description:
          `${description}${truncated ? "\n\nFull details are available in MarketPilot." : ""}` ||
          "Open MarketPilot to continue.",
        color: 0x5865f2,
        footer: { text: "MarketPilot · Private market workspace" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
