export type NotificationCategory = "SECURITY" | "ACCOUNT" | "ANNOUNCEMENT" | "MARKET_ALERT";
export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";
export interface MarketAlertReport {
  alertId: string;
  assetId: string;
  condition:
    | "PRICE_ABOVE"
    | "PRICE_BELOW"
    | "RSI_ABOVE"
    | "RSI_BELOW"
    | "PERCENT_CHANGE_ABOVE"
    | "PERCENT_CHANGE_BELOW";
  threshold: string;
  value: string;
  unit: string;
  interval: string;
  observationAt: string;
  source: string;
  providerSymbol: string;
  priceKind: string;
}
export interface NotificationRecord {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionPath: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  marketAlert?: MarketAlertReport | null;
}
export interface NotificationSummary {
  unread: number;
  inbox: number;
  archived: number;
}
export const categoryLabels = {
  SECURITY: "Security",
  ACCOUNT: "Account",
  ANNOUNCEMENT: "Announcements",
  MARKET_ALERT: "Market alerts",
} as const;
export const severityLabels = { INFO: "Information", WARNING: "Important", CRITICAL: "Urgent" } as const;
