import { Check, Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import type { BillingOverview } from "./billing-types";

export function BillingPlans({ data, busy, checkout }: { data: BillingOverview; busy: boolean; checkout: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(["FREE", "PRO"] as const).map((key) => {
        const plan = data.plans[key];
        const current = key === data.plan;
        let price = `$${data.proTestPriceCents / 100}`;
        let period = "/ month · test price";
        if (data.mode === "demo") {
          price = "No charge";
          period = "30-day demo";
        }
        if (key === "FREE") {
          price = "$0";
          period = "forever";
        }
        let action = data.mode === "demo" ? "Try demo Pro" : "Open test checkout";
        if (data.mode === "disabled") action = "Test billing unavailable";
        if (key === "FREE") action = "Included with every account";
        if (current) action = "Your current plan";
        const features = [
          `${plan.aiDaily} AI research requests / day`,
          `${plan.activeAlerts} active alerts`,
          `${plan.watchlists} watchlists · ${plan.watchlistItems} assets per list`,
          `${plan.apiDaily.toLocaleString()} API requests / day · ${plan.apiKeys} active ${plan.apiKeys === 1 ? "key" : "keys"}`,
          plan.externalAlerts ? "Telegram & Discord alert delivery" : "Dashboard alert delivery",
        ];
        return (
          <Card key={key} className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <CardTitle className="flex items-center gap-2">
                  {key === "PRO" && <Crown className="size-4" />}
                  {plan.name}
                </CardTitle>
                <CardDescription>
                  {key === "FREE"
                    ? "Explore market intelligence at your own pace."
                    : "More room for research, monitoring and integrations."}
                </CardDescription>
              </div>
              {current && (
                <Badge variant="secondary" className="shrink-0">
                  Current plan
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5">
              <div>
                <p className="font-semibold text-3xl tracking-tight">
                  {price}
                  <span className="ml-2 font-normal text-muted-foreground text-sm">{period}</span>
                </p>
                {key === "PRO" && (
                  <p className="mt-1 text-muted-foreground text-xs">
                    Sandbox pricing only. No real money is collected.
                  </p>
                )}
              </div>
              <ul className="flex flex-col gap-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={key === "FREE" ? "outline" : "default"}
                disabled={current || key === "FREE" || busy || data.mode === "disabled"}
                onClick={checkout}
              >
                {action}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
