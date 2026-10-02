import type { NotificationSeverity } from "../../../notifications/_components/notification-types";
export type AnnouncementAudience = "ALL" | "USERS" | "ADMINS";
export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  actionPath: string | null;
  severity: NotificationSeverity;
  audience: AnnouncementAudience;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  recipientCount: number;
  excludedCount: number;
  readCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { name: string | null; email: string } | null;
}
export interface AnnouncementSummary {
  drafts: number;
  published: number;
  delivered: number;
  read: number;
}
export const audienceLabels = {
  ALL: "All active accounts",
  USERS: "Users only",
  ADMINS: "Administrators only",
} as const;
export const destinations = [
  ["none", "No link"],
  ["/dashboard/default", "Dashboard"],
  ["/dashboard/markets", "Markets"],
  ["/dashboard/watchlist", "Watchlist"],
  ["/dashboard/journal", "Journal"],
  ["/dashboard/news-and-sentiment", "News"],
  ["/dashboard/alerts", "Alert rules"],
  ["/dashboard/api/documentation", "API guide"],
  ["/dashboard/settings/security", "Security settings"],
  ["/dashboard/notifications", "Notification center"],
] as const;
