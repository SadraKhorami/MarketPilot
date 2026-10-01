import { createCipheriv, createDecipheriv, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";
export function encryptPayload(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", payloadKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decryptPayload(value: string): unknown {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", payloadKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
}
function payloadKey() {
  const key = process.env.BOT_PAYLOAD_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error("BOT_KEY_UNAVAILABLE");
  return Buffer.from(key, "hex");
}
export function validTelegramSecret(value: string | undefined) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !value) return false;
  const supplied = Buffer.from(value);
  const secret = Buffer.from(expected);
  return supplied.length === secret.length && timingSafeEqual(supplied, secret);
}
export function validDiscordSignature(body: Buffer, signature: string | undefined, timestamp: string | undefined) {
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (
    !key ||
    !signature ||
    !timestamp ||
    !/^[a-fA-F0-9]{128}$/.test(signature) ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.concat([Buffer.from(timestamp), body]), publicKey, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
// Plain text Telegram messages; Discord has no mentions and escapes user-controlled Markdown.
export function plainText(value: string) {
  return Array.from(value)
    .filter((character) => {
      const point = character.codePointAt(0) ?? 0;
      return (
        !(point < 32 && ![9, 10, 13].includes(point)) &&
        point !== 127 &&
        !(point >= 0x202a && point <= 0x202e) &&
        !(point >= 0x2066 && point <= 0x2069)
      );
    })
    .join("");
}
const discordMarkup = new Set(["\\", "`", "*", "_", "~", "|", ">", "[", "]", "(", ")", "#"]);
export function discordText(value: string) {
  return Array.from(plainText(value))
    .map((character) => {
      if (character === "@") return "@\u200b";
      return discordMarkup.has(character) ? `\\${character}` : character;
    })
    .join("");
}
export function splitText(value: string, limit: number, maximumParts = 6) {
  const points = Array.from(plainText(value));
  const chunks: string[] = [];
  // UTF-16 units bound both platform limits without splitting a surrogate pair.
  let chunk = "";
  for (const point of points) {
    if (chunk.length + point.length > limit) {
      chunks.push(chunk);
      chunk = "";
    }
    if (chunks.length >= maximumParts) break;
    chunk += point;
  }
  if (chunk && chunks.length < maximumParts) chunks.push(chunk);
  return chunks;
}
