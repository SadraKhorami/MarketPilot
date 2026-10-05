import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { BillingOverview } from "./billing-types";
export function BillingUsage({ data }: { data: BillingOverview }) {
  const limits = data.plans[data.plan];
  const rows = [
    { label: "AI research", used: data.usage.ai, limit: limits.aiDaily, period: "today" },
    { label: "Developer API", used: data.usage.api, limit: limits.apiDaily, period: "today" },
    { label: "Active alerts", used: data.usage.activeAlerts, limit: limits.activeAlerts, period: "saved" },
    { label: "Watchlists", used: data.usage.watchlists, limit: limits.watchlists, period: "saved" },
    { label: "Active API keys", used: data.usage.apiKeys, limit: limits.apiKeys, period: "saved" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your allowance</CardTitle>
        <CardDescription>Daily allowances reset at {new Date(data.resetAt).toLocaleString()}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {row.used.toLocaleString()} / {row.limit.toLocaleString()}
                </span>
              </div>
              <Progress
                aria-label={`${row.label}: ${row.used} of ${row.limit}`}
                value={Math.min(100, (row.used / row.limit) * 100)}
              />
              <p className="text-muted-foreground text-xs">
                {row.used > row.limit
                  ? "Existing resources are kept. Remove unused resources before adding more."
                  : `${Math.max(0, row.limit - row.used).toLocaleString()} remaining · ${row.period}`}
              </p>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {data.providerSafetyBudget} Failed or cancelled research that has started also counts toward your allowance.
          Browser requests are excluded from API usage.
        </p>
      </CardContent>
    </Card>
  );
}
