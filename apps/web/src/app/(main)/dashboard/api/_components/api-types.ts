export interface KeyRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt?: string | null;
}
export interface ApiCatalog {
  version: string;
  scopes: Array<{ id: string; title: string }>;
  authentication: string;
  rateLimit: { requests: number; windowSeconds: number; per: string };
  endpoints: Array<{
    method: string;
    path: string;
    scope: string;
    title: string;
    description: string;
    parameters: string;
    response: string;
  }>;
}
export interface KeyUsage {
  days: number;
  keyCount: number;
  period: { since: string; until: string; timeZone: "UTC" };
  page: number;
  pageSize: number;
  totalPages: number;
  rateLimitedRequests: number;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  averageLatencyMs: number | null;
  rateLimit: ApiCatalog["rateLimit"];
  byDay: Array<{ day: string; requests: number }>;
  recent: Array<{
    id: string;
    requestId: string;
    route: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    occurredAt: string;
    apiKey: { name: string; prefix: string } | null;
  }>;
}
