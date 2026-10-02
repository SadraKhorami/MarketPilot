"use client";
import { useState } from "react";

import { permitsTradeSetup, type TradeContext } from "@marketpilot/ai/contracts";
import { ArrowUp, Info, Plus, Sparkles, Square } from "lucide-react";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import { ResearchConversation } from "./research-conversation";
import { ResearchHistory } from "./research-history";
import { toolLabels } from "./research-stream";
import { ResearchSuggestions, type ResearchWatchlist } from "./research-suggestions";
import { TradeContextQuestion } from "./trade-context-question";
import { useResearch } from "./use-research";

interface AiStatus {
  configured: boolean;
  status: string;
  message: string;
}
function activityLabel(event: { state: string; status?: string }, running: boolean) {
  if (event.state === "running") return running ? "Working" : "Interrupted";
  return event.status === "ok" ? "Received" : "Limited";
}
export function AIAnalystWorkspace() {
  const status = useApiResource<AiStatus>("/ai/status");
  const lists = useApiResource<ResearchWatchlist[]>("/watchlists");
  const research = useResearch();
  const [tradeRequest, setTradeRequest] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [symbol, setSymbol] = useState("BTC-USD");
  const [watchlistId, setWatchlistId] = useState("default");
  const disabled = !status.data?.configured || !research.ready || research.running;
  function submit(value: string) {
    if (disabled || !value.trim()) return;
    if (permitsTradeSetup(value)) {
      setTradeRequest(value);
      return;
    }
    setInput("");
    void research.send(value, watchlistId === "default" ? undefined : watchlistId);
  }
  function requestSetup() {
    if (!disabled)
      setTradeRequest(
        `Give me a conditional trade setup for ${symbol}, with Entry, Stop loss and supported targets. Check higher-timeframe context. If no valid setup exists, state the reason. Do not save a journal plan or create alerts without my confirmation.`,
      );
  }
  function confirmSetup(context: TradeContext) {
    const question = tradeRequest;
    if (!question || disabled) return;
    setTradeRequest(null);
    setInput("");
    void research.send(question, watchlistId === "default" ? undefined : watchlistId, undefined, context);
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Card className="h-[70dvh] min-h-0 min-w-0 xl:h-full">
        <CardHeader className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-full space-y-1 sm:basis-auto">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Market research
            </CardTitle>
            <CardDescription>Observed facts and cited interpretation, using your MarketPilot sources.</CardDescription>
          </div>
          <CardAction className="flex w-full shrink-0 flex-wrap justify-end gap-2 sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="About AI research">
                  <Info />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-4">
                <h2 className="font-medium">How research works</h2>
                <p className="text-muted-foreground text-sm">
                  Market choices fill the suggested asset questions. Your watchlist choice also applies when your typed
                  question refers to your watchlist.
                </p>
                <p className="text-muted-foreground text-sm">
                  Bare asset names use USD pairs. Sentiment scoring and historical watchlist changes are unavailable.
                  Private research is retained for seven days; conversations show the latest twenty turns. Alerts always
                  require your confirmation.
                </p>
              </PopoverContent>
            </Popover>
            <ResearchHistory
              currentId={research.conversationId}
              disabled={research.running || !research.ready}
              onSelect={research.openConversation}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={research.running}
              onClick={() => {
                setTradeRequest(null);
                research.newConversation();
              }}
            >
              <Plus data-icon="inline-start" />
              New
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          {status.loading ? <Skeleton className="h-12 w-full" /> : null}
          {!status.loading && status.error ? (
            <ResourceState loading={false} error={status.error} title="Research unavailable" retry={status.reload} />
          ) : null}
          {!status.loading && !status.error && !status.data?.configured ? (
            <Alert className="shrink-0">
              <AlertTitle>AI research is not configured</AlertTitle>
              <AlertDescription>{status.data?.message}</AlertDescription>
            </Alert>
          ) : null}
          {research.historyError ? (
            <ResourceState
              loading={false}
              error={research.historyError}
              title="History unavailable"
              retry={research.recover}
            />
          ) : null}
          {!research.ready ? <Skeleton className="min-h-0 flex-1" /> : null}
          {research.ready && !research.turns.length && !tradeRequest ? (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto py-4 md:justify-center">
              <ResearchSuggestions
                symbol={symbol}
                onSymbolChange={setSymbol}
                watchlistId={watchlistId}
                onWatchlistChange={setWatchlistId}
                lists={lists.data}
                listsLoading={lists.loading}
                listsError={lists.error}
                disabled={disabled}
                running={research.running}
                onSubmit={submit}
                onTradeSetup={requestSetup}
              />
            </div>
          ) : null}
          {research.ready && (research.turns.length > 0 || tradeRequest) ? (
            <ResearchConversation
              research={research}
              disabled={disabled}
              watchlistId={watchlistId}
              onTradeRequest={setTradeRequest}
            >
              {tradeRequest ? (
                <TradeContextQuestion symbol={symbol} onConfirm={confirmSetup} onCancel={() => setTradeRequest(null)} />
              ) : null}
            </ResearchConversation>
          ) : null}
          {research.running ? (
            <p role="status" aria-live="polite" className="shrink-0 text-muted-foreground text-sm">
              {research.progress}
              {research.activity
                .filter((event, i, all) => all.findLastIndex((entry) => entry.tool === event.tool) === i)
                .map((event) => (
                  <Badge key={event.tool} variant="outline" className="ml-2">
                    {toolLabels[event.tool]} · {activityLabel(event, true)}
                  </Badge>
                ))}
            </p>
          ) : null}
        </CardContent>
        {!tradeRequest ? (
          <CardFooter className="shrink-0">
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
                      className="max-h-32 overflow-y-auto"
                      id="research-question"
                      placeholder="Ask about a market, your watchlist or an alert rule…"
                      maxLength={2000}
                      value={input}
                      disabled={!status.data?.configured || research.running || !!tradeRequest}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          submit(input);
                        }
                      }}
                    />
                    <InputGroupAddon align="block-end" className="flex-wrap">
                      {research.turns.length > 0 && !research.running && !tradeRequest ? (
                        <ResearchSuggestions
                          compact
                          symbol={symbol}
                          onSymbolChange={setSymbol}
                          watchlistId={watchlistId}
                          onWatchlistChange={setWatchlistId}
                          lists={lists.data}
                          listsLoading={lists.loading}
                          listsError={lists.error}
                          disabled={disabled}
                          running={research.running}
                          onSubmit={submit}
                          onTradeSetup={requestSetup}
                        />
                      ) : null}
                      <span className="mr-auto text-xs">{input.length}/2000 · Shift+Enter for a new line</span>
                      {research.running ? (
                        <Button type="button" size="sm" variant="outline" onClick={research.cancel}>
                          <Square data-icon="inline-start" />
                          Cancel
                        </Button>
                      ) : (
                        <Button type="submit" size="sm" disabled={disabled || !!tradeRequest || !input.trim()}>
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
        ) : null}
      </Card>
    </div>
  );
}
