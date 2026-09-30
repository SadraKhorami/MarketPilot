export interface AccountIdentity {
  id: string;
  email: string;
  name: string | null;
}
export interface AccountRow extends AccountIdentity {
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  updatedAt: string;
  roles: Array<{ role: { name: string } }>;
  _count: { apiKeys: number; watchlists: number; alerts: number; activity?: number };
}
export interface AuditRow {
  id: string;
  description: string;
  eventType: string;
  occurredAt: string;
  requestId?: string | null;
  user: AccountIdentity;
}
export interface RequestRow {
  id: string;
  requestId: string;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  occurredAt: string;
  authType: "SESSION" | "API_KEY";
  user: AccountIdentity;
  apiKey: { name: string; prefix: string } | null;
}
export interface AdminKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  user: AccountIdentity;
  _count: { usage: number };
}
export interface AdminOverview {
  days: number;
  users: number;
  activeUsers: number;
  admins: number;
  activeKeys: number;
  activeSessions: number;
  requests: number;
  errors: number;
  averageLatencyMs: number | null;
  traffic: Array<{ day: string; browser: number; keys: number }>;
  events: AuditRow[];
  endpoints: Array<{ route: string; requests: number }>;
}
export interface SystemState {
  checkedAt: string;
  database: { status: string; latencyMs: number | null };
  redis: { status: string; latencyMs: number | null };
  articles: number | null;
  integrations: Array<{ name: string; status: string; detail: string }>;
}
