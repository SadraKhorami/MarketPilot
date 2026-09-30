"use client";
import { useState } from "react";

import { ArrowUp, Plus, Sparkles, Square } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/hooks/use-api-resource";

import { MarketSymbolField } from "../../_components/market-symbol-field";
import { ResearchConversation } from "./research-conversation";
import { toolLabels } from "./research-stream";
import { useResearch } from "./use-research";

interface AiStatus {
  configured: boolean;
  status: string;
  message: string;
}
interface Watchlist {
  id: string;
  name: string;
  items: Array<{ assetId: string }>;
}
function activityLabel(event: { state: string; status?: string }) {
  if (event.state === "running") return "Working";
  return event.status === "ok" ? "Received" : "Limited";
}
export function AIAnalystWorkspace() {
  const status = useApiResource<AiStatus>("/ai/status");
  const lists = useApiResource<Watchlist[]>("/watchlists");
  const research = useResearch();
  const [input, setInput] = useState("");
  const [symbol, setSymbol] = useState("BTC-USD");
  const [watchlistId, setWatchlistId] = useState("default");
  const disabled = !status.data?.configured || !research.ready || research.running;
  const suggestions = [
    {
      title: "Analyze BTC",
      prompt: "Analyze BTC using current price, technical indicators, trend and available stored news.",
    },
    { title: "Compare BTC and ETH", prompt: "Compare BTC and ETH using the same hourly candle window." },
    {
      title: "Summarize my watchlist",
      prompt: "Summarize my selected watchlist with actual market observations and their limitations.",
    },
    {
      title: "Explain the technical indicators",
      prompt: `Explain the current technical indicators for ${symbol} and their limitations.`,
    },
  ];
  function submit(value: string) {
    if (disabled || !value.trim()) return;
    setInput("");
    void research.send(value, watchlistId === "default" ? undefined : watchlistId);
  }
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Market research
          </CardTitle>
          <CardDescription>Observed facts and cited interpretation, using your MarketPilot sources.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" disabled={research.running} onClick={research.newConversation}>
              <Plus data-icon="inline-start" />
              New
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          {status.loading ? <Skeleton className="h-12 w-full" /> : null}
          {!status.loading && status.error ? (
            <Alert variant="destructive">
              <AlertTitle>Research unavailable</AlertTitle>
              <AlertDescription>
                {status.error}
                <Button variant="outline" size="sm" onClick={status.reload}>
                  Retry connection
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {!status.loading && !status.error && !status.data?.configured ? (
            <Alert>
              <AlertTitle>AI research is not configured</AlertTitle>
              <AlertDescription>{status.data?.message}</AlertDescription>
            </Alert>
          ) : null}
          {research.historyError ? (
            <Alert variant="destructive">
              <AlertTitle>History unavailable</AlertTitle>
              <AlertDescription>
                {research.historyError}
                <Button variant="outline" size="sm" onClick={research.recover}>
                  Recover history
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {!research.turns.length ? (
            <>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Sparkles />
                  </EmptyMedia>
                  <EmptyTitle>Start with a market question</EmptyTitle>
                  <EmptyDescription>
                    Explore a supported asset, compare market observations or research your watchlist. Each lookup
                    preserves its source, time and missing data.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion.title}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-3 text-left"
                    disabled={disabled}
                    onClick={() => submit(suggestion.prompt)}
                  >
                    {suggestion.title}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <ResearchConversation research={research} disabled={disabled} watchlistId={watchlistId} />
          )}
          {research.running ? (
            <p role="status" aria-live="polite" className="text-muted-foreground text-sm">
              {research.progress}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <form
            className="w-full"
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="research-question" className="sr-only">
                  Research question
                </FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    id="research-question"
                    placeholder="Ask about a market, your watchlist or an alert rule…"
                    maxLength={2000}
                    value={input}
                    disabled={!status.data?.configured || research.running}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        submit(input);
                      }
                    }}
                  />
                  <InputGroupAddon align="block-end">
                    <span className="mr-auto text-xs">{input.length}/2000 · Shift+Enter for a new line</span>
                    {research.running ? (
                      <Button type="button" size="sm" variant="outline" onClick={research.cancel}>
                        <Square data-icon="inline-start" />
                        Cancel
                      </Button>
                    ) : (
                      <Button type="submit" size="sm" disabled={disabled || !input.trim()}>
                        <ArrowUp data-icon="inline-start" />
                        Research
                      </Button>
                    )}
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </FieldGroup>
          </form>
        </CardFooter>
      </Card>
      <aside className="flex min-w-0 flex-col gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Research context</CardTitle>
            <CardDescription>Choose context for the suggested questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="research-market">Market</FieldLabel>
                <MarketSymbolField
                  id="research-market"
                  value={symbol}
                  onChange={setSymbol}
                  disabled={research.running}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="research-watchlist">Watchlist</FieldLabel>
                <Select
                  value={watchlistId}
                  onValueChange={setWatchlistId}
                  disabled={research.running || lists.loading || !!lists.error}
                >
                  <SelectTrigger id="research-watchlist" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="default">First watchlist</SelectItem>
                      {lists.data?.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} · {list.items.length} assets
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {lists.error ? <p className="text-muted-foreground text-xs">Watchlists could not be loaded.</p> : null}
                {!lists.error && lists.data?.length === 0 ? (
                  <p className="text-muted-foreground text-xs">You have no watchlists yet.</p>
                ) : null}
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Source activity</CardTitle>
            <CardDescription>{research.running ? "Lookups in progress" : "Latest research request"}</CardDescription>
          </CardHeader>
          <CardContent>
            {research.activity.length ? (
              <ul className="flex flex-col gap-2">
                {research.activity
                  .filter((event, i, all) => all.findLastIndex((entry) => entry.tool === event.tool) === i)
                  .map((event) => (
                    <li key={event.tool} className="flex items-center justify-between gap-2 text-xs">
                      <span>{toolLabels[event.tool]}</span>
                      <Badge variant="outline">{activityLabel(event)}</Badge>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">Actual lookups appear when research begins.</p>
            )}
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Bare asset names use USD pairs. Sentiment scoring and historical watchlist changes are unavailable. Private
          research is retained for seven days; the conversation shows the latest twenty turns. Alert rules require your
          confirmation.
        </p>
      </aside>
    </div>
  );
}
