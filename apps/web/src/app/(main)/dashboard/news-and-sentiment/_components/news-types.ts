export interface Article {
  id: string;
  source: string;
  title: string;
  description: string | null;
  originalUrl: string;
  publishedAt: string | null;
  fetchedAt: string;
  sourceCategories: string[];
  affectedAssets: string[];
}
export interface NewsResponse {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  refreshState: { enabled?: boolean; status?: string; checkedAt?: string };
}

export function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Date not provided";
}
