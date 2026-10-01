"use client";
import { useEffect, useState } from "react";

import Link from "next/link";

import { Bell, History, Link2, MessageCircle, Send, Terminal } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks/use-api-resource";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { ResourceState } from "../../_components/resource-state";
import { BotCommands } from "./bot-commands";
import { BotDeliveryHistory } from "./bot-delivery-history";
import { BotLinkPanel } from "./bot-link-panel";
import type { BotState, LinkToken, Provider } from "./bot-types";

export function BotIntegration({ provider }: { provider: Provider }) {
  const resource = useApiResource<BotState>(`/bots/${provider}`, { keepDataOnReload: true });
  const [token, setToken] = useState<LinkToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const name = provider === "telegram" ? "Telegram" : "Discord";
  const Icon = provider === "telegram" ? Send : MessageCircle;
  const state = resource.data;
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      resource.reload();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [resource.reload]);
  async function action(operation: "link" | "confirm" | "disconnect" | "preferences", marketAlerts?: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (operation === "link") {
        const response = await apiRequest<ApiEnvelope<LinkToken>>(`/bots/${provider}/link`, { method: "POST" });
        setToken(response.data);
      } else {
        const methods = { disconnect: "DELETE", preferences: "PATCH", confirm: "POST" };
        let body: string | undefined;
        if (operation === "confirm") body = JSON.stringify({ id: state?.candidate?.id });
        if (operation === "preferences") body = JSON.stringify({ marketAlerts });
        await apiRequest(`/bots/${provider}/${operation === "disconnect" ? "link" : operation}`, {
          method: methods[operation],
          body,
        });
        if (operation !== "preferences") setToken(null);
      }
      resource.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not update the bot connection.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ResourceState {...resource} retry={resource.reload} />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not update connection</AlertTitle>
          <AlertDescription>
            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 flex-1">{error}</p>
              <Button
                className="shrink-0"
                variant="outline"
                onClick={() => {
                  setError(null);
                  resource.reload();
                }}
              >
                Reload status
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {state && !resource.error ? (
        <>
          <Card className="min-w-0">
            <CardContent className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">MarketPilot on {name}</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Link your own {name} account to the MarketPilot bot. No bot token is needed.
                  </p>
                </div>
              </div>
              <Badge
                className="shrink-0 self-start sm:self-center"
                variant={state.channel?.active ? "secondary" : "outline"}
              >
                {state.channel?.active ? "Account linked" : "Account not linked"}
              </Badge>
            </CardContent>
          </Card>
          <Tabs defaultValue="connection" className="min-w-0 gap-4">
            <div className="min-w-0 overflow-x-auto">
              <TabsList aria-label={`${name} integration`}>
                <TabsTrigger value="connection">
                  <Link2 aria-hidden="true" />
                  Connection
                </TabsTrigger>
                <TabsTrigger value="commands">
                  <Terminal aria-hidden="true" />
                  Commands
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History aria-hidden="true" />
                  Delivery history
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="connection" className="min-w-0 space-y-4">
              <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
                <div className="min-w-0 space-y-4 xl:col-span-2">
                  {state.channel?.active ? (
                    <>
                      <Card className="min-w-0">
                        <CardHeader>
                          <CardTitle>Connected account</CardTitle>
                          <CardDescription>
                            Research commands are available through your verified account.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-medium">{state.channel.displayName ?? "Verified account"}</p>
                            <p className="mt-1 break-all text-muted-foreground text-sm">
                              Account ID: {state.channel.externalAccountId}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                              Linked{" "}
                              {state.channel.verifiedAt ? new Date(state.channel.verifiedAt).toLocaleString() : "—"}
                            </p>
                          </div>
                          <Button
                            className="shrink-0 self-start"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void action("disconnect")}
                          >
                            Disconnect
                          </Button>
                        </CardContent>
                      </Card>
                      <Card className="min-w-0">
                        <CardHeader>
                          <CardTitle>Market alert notifications</CardTitle>
                          <CardDescription>
                            Receive new crossings of your enabled saved rules. Your dashboard inbox is managed
                            separately.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex min-w-0 items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <Label htmlFor={`${provider}-alerts`}>Send market alerts to {name}</Label>
                            <p className="mt-1 text-muted-foreground text-sm">
                              {provider === "discord"
                                ? "Delivered by private DM. Allow direct messages from the bot."
                                : "Delivered to your verified private chat."}
                            </p>
                          </div>
                          <Switch
                            className="shrink-0"
                            id={`${provider}-alerts`}
                            checked={state.channel.preferences.marketAlerts === true}
                            disabled={busy}
                            onCheckedChange={(value) => void action("preferences", value)}
                          />
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                  {!state.channel?.active && state.configuration.configured ? (
                    <BotLinkPanel
                      provider={provider}
                      state={state}
                      token={token}
                      busy={busy}
                      now={now}
                      action={(operation) => void action(operation)}
                    />
                  ) : null}
                  {!state.channel?.active && !state.configuration.configured ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>{name} is not available yet</CardTitle>
                        <CardDescription>
                          The MarketPilot team needs to finish setting up this bot. Once it is ready, create a private
                          link here and confirm your account to start using research and notifications.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ) : null}
                </div>
                <Card className="min-w-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="size-4" aria-hidden="true" />
                      What you can do
                    </CardTitle>
                    <CardDescription>MarketPilot, directly in your private chat.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Research markets</p>
                      <p className="text-muted-foreground text-sm">
                        Ask a question, check a price or review your watchlists using bot commands.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Receive saved-rule alerts</p>
                      <p className="text-muted-foreground text-sm">
                        After linking, turn on notifications here for your enabled market rules.
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-muted-foreground text-xs">
                        Disconnect at any time to stop future deliveries to this account.
                      </p>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/dashboard/alerts">Manage alert rules</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="commands" className="min-w-0">
              <BotCommands provider={provider} />
            </TabsContent>
            <TabsContent value="history" className="min-w-0">
              <BotDeliveryHistory provider={provider} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
