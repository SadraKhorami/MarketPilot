export type NotificationCategory = "SECURITY" | "ACCOUNT" | "ANNOUNCEMENT" | "MARKET_ALERT";
export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";
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
