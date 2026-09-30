import type { KeyRecord } from "./api-types";
export function getKeyStatus(key: Pick<KeyRecord, "revokedAt" | "expiresAt">) {
  if (key.revokedAt) return "Revoked";
  if (key.expiresAt && Date.parse(key.expiresAt) <= Date.now()) return "Expired";
  return "Active";
}
