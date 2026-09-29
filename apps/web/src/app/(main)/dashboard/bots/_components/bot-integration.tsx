"use client";

import { useState } from "react";

import Link from "next/link";

import { Bot, Check, CircleAlert, MessageCircle, Send, Settings2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Provider = "telegram" | "discord";

export function BotIntegration({ provider }: { provider: Provider }) {
  const [preferences, setPreferences] = useState({ alerts: true, dailySummary: false, sentiment: false });
  const isTelegram = provider === "telegram";
  const name = isTelegram ? "Telegram" : "Discord";
  const Icon = isTelegram ? Send : MessageCircle;
  const preferenceOptions: Array<{ key: keyof typeof preferences; label: string; description: string }> = [
    { key: "alerts", label: "Market alerts", description: "Receive a message when an alert condition is met." },
    { key: "dailySummary", label: "Daily market summary", description: "A concise summary at your preferred time." },
    { key: "sentiment", label: "Sentiment changes", description: "Updates when sentiment signals shift." },
  ];

  const setPreference = (key: keyof typeof preferences, checked: boolean) =>
    setPreferences((current) => ({ ...current, [key]: checked }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <div className="space-y-4">
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl border bg-muted/40">
                <Icon className="size-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold text-lg">{name} notifications</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  Send alert updates and selected summaries to {name}.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Disconnected</Badge>
                  <Badge variant="secondary">Setup preview</Badge>
                </div>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Icon /> Connect {name}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect {name}</DialogTitle>
                  <DialogDescription>
                    Account linking is not available in this frontend phase. No bot API or account will be contacted.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium text-sm">What a future connection will do</p>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground text-sm">
                      <li>Generate a short-lived link code in MarketPilot.</li>
                      <li>Confirm your platform identity through a private bot command.</li>
                      <li>Choose which notifications the bot may send.</li>
                    </ol>
                  </div>
                  <Alert>
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>Integration unavailable</AlertTitle>
                    <AlertDescription>
                      This preview does not create a link code or store a platform account.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4" aria-hidden="true" />
              Notification preferences
            </CardTitle>
            <CardDescription>Temporary browser state · preferences are not saved</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {preferenceOptions.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <Label htmlFor={`bot-pref-${key}`} className="font-medium">
                    {label}
                  </Label>
                  <p className="mt-1 text-muted-foreground text-sm">{description}</p>
                </div>
                <Switch
                  id={`bot-pref-${key}`}
                  checked={preferences[key]}
                  onCheckedChange={(checked) => setPreference(key, checked)}
                  aria-label={`${label} preference`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Bot status</CardTitle>
            <CardDescription>{name} adapter health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Bot className="size-4" aria-hidden="true" />
                Connection
              </span>
              <span className="font-medium">Not connected</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Authentication
              </span>
              <span className="font-medium">Not configured</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Check className="size-4" aria-hidden="true" />
                Last delivery
              </span>
              <span className="font-medium">No deliveries</span>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground text-sm">
              Preferences above are visual preview state only. They reset when this page is reloaded.
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Manage platforms</CardTitle>
            <CardDescription>Connections are not active in this preview</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant={isTelegram ? "secondary" : "outline"} asChild>
              <Link href="/dashboard/bots/telegram">
                <Send /> Telegram
              </Link>
            </Button>
            <Button variant={!isTelegram ? "secondary" : "outline"} asChild>
              <Link href="/dashboard/bots/discord">
                <MessageCircle /> Discord
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
