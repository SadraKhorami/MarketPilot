export const newsPeriods = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
] as const;

export type NewsPeriod = (typeof newsPeriods)[number]["value"];

export function publicationWindow(period: NewsPeriod, now = new Date()) {
  if (period === "all") return null;
  const from = new Date(now);
  if (period === "today") from.setHours(0, 0, 0, 0);
  else from.setTime(now.getTime() - (period === "3d" ? 3 : 7) * 24 * 60 * 60 * 1000);
  return { from, to: now };
}
