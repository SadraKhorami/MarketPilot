import Link from "next/link";

import { Bot, CircleAlert, MessageCircle, Send, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Provider = "telegram" | "discord";

export function BotIntegration({ provider }: { provider: Provider }) {
  const isTelegram = provider === "telegram";
  const name = isTelegram ? "Telegram" : "Discord";
  const Icon = isTelegram ? Send : MessageCircle;
  const preferences = [
    {
      key: "alerts",
      label: "Market alerts",
      description: "Send saved alert events after rule evaluation is available.",
    },
    {
      key: "dailySummary",
      label: "Daily market summary",
      description: "Deliver a summary when scheduled messaging is supported.",
    },
    {
      key: "sentiment",
      label: "Sentiment changes",
      description: "Send updates if a verified sentiment source is added.",
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl border bg-muted/40">
                <Icon className="size-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold text-lg">{name} notifications</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Connect this platform to receive MarketPilot updates.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Not connected</Badge>
                  <Badge variant="secondary">Integration unavailable</Badge>
                </div>
              </div>
            </div>
            <Button disabled>
              <Icon data-icon="inline-start" />
              Connection unavailable
            </Button>
          </CardContent>
        </Card>
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{name} integration is not configured</AlertTitle>
          <AlertDescription>No account link, bot token, or message delivery is created by this page.</AlertDescription>
        </Alert>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Notification options</CardTitle>
            <CardDescription>
              Options stay unavailable until a secure platform connection is implemented.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {preferences.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <Label htmlFor={`${provider}-pref-${key}`} className="font-medium">
                    {label}
                  </Label>
                  <p className="mt-1 text-muted-foreground text-sm">{description}</p>
                </div>
                <Switch id={`${provider}-pref-${key}`} checked={false} disabled aria-label={`${label} unavailable`} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Connection status</CardTitle>
            <CardDescription>Current {name} integration state</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatusRow label="Connection" value="Not connected" icon={Bot} />
            <StatusRow label="Authentication" value="Not configured" icon={ShieldCheck} />
            <StatusRow label="Recent deliveries" value="None" icon={Icon} />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Available platforms</CardTitle>
            <CardDescription>Neither notification adapter is active.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant={isTelegram ? "secondary" : "outline"} asChild>
              <Link href="/dashboard/bots/telegram">
                <Send data-icon="inline-start" />
                Telegram
              </Link>
            </Button>
            <Button variant={!isTelegram ? "secondary" : "outline"} asChild>
              <Link href="/dashboard/bots/discord">
                <MessageCircle data-icon="inline-start" />
                Discord
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Bot }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden="true" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
