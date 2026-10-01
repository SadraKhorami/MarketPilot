export interface DeliveryRecord {
  id: string;
  status: string;
  attempts: number;
  failureCode: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string;
  receiptId?: string | null;
  trigger: { assetId: string; condition?: string; alertId?: string };
}
export const deliveryLabels: Record<string, string> = {
  pending: "Queued",
  retry: "Retry scheduled",
  sending: "Sending / checking receipt",
  delivered: "Delivered",
  suppressed: "Skipped",
  failed: "Failed",
  unknown: "Acceptance unknown",
};
export function deliveryReason(code: string | null) {
  const reasons: Record<string, string> = {
    PROVIDER_NOT_CONFIGURED: "Waiting for administrator configuration",
    DESTINATION_UNAVAILABLE: "The bot cannot message this account; check blocking and privacy settings",
    PROVIDER_CREDENTIAL_INVALID: "Administrator must update provider credentials",
    PROVIDER_RATE_LIMITED: "Waiting for the platform rate limit",
    PROVIDER_ACCEPTANCE_UNKNOWN: "The platform may have accepted this message; automatic resend stopped",
    PROVIDER_NETWORK: "Platform response unavailable",
    PROVIDER_UNAVAILABLE: "Platform temporarily unavailable",
    ACCOUNT_DISCONNECTED: "Account disconnected",
    DELIVERY_NOT_ELIGIBLE: "Connection, preference, account or rule no longer eligible",
    DELIVERY_ATTEMPTS_EXHAUSTED: "Automatic retry limit reached",
    JOB_ATTEMPTS_EXHAUSTED: "Queue retry limit reached",
  };
  return code ? (reasons[code] ?? "Delivery needs administrator review") : null;
}
