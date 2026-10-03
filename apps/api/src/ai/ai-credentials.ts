import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AIError } from "@marketpilot/ai";
export function credentialStorageReady() {
  return /^[a-f\d]{64}$/i.test(process.env.AI_CREDENTIAL_KEY ?? "");
}
function credentialKey() {
  if (!credentialStorageReady())
    throw new AIError("AI_KEY_STORAGE_UNAVAILABLE", "Personal key storage is not configured.");
  return Buffer.from(process.env.AI_CREDENTIAL_KEY!, "hex");
}
export function sealCredential(userId: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function openCredential(userId: string, stored: string) {
  try {
    const data = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", credentialKey(), data.subarray(0, 12));
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    throw new AIError("AI_KEY_UNAVAILABLE", "Your personal key could not be opened. Reconnect it in AI settings.");
  }
}
