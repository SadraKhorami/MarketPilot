"use client";

import { useState } from "react";

import {
  ArrowUp,
  Bot,
  Check,
  CircleDashed,
  CircleHelp,
  Database,
  FileText,
  LockKeyhole,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { defaultWatchlist, demoAssets, findAsset, formatPrice } from "@/data/marketpilot";

const prompts = ["Analyze BTC", "Compare BTC and ETH", "Summarize today's market", "What changed in my watchlist?"];
const toolNames = [
  "getMarketPrice",
  "getTechnicalIndicators",
  "getTrendAnalysis",
  "getMarketNews",
  "getSentiment",
  "getWatchlist",
  "compareAssets",
  "createAlert",
];

export function AIAnalystWorkspace() {
  const [draft, setDraft] = useState("");
  const btc = findAsset("BTC");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    toast.info("The AI service is not connected. No request was sent.");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
      <Card className="flex min-h-[640px] flex-col shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-base">MarketPilot Analyst</CardTitle>
              <CardDescription>Tool-grounded market research workspace</CardDescription>
            </div>
            <Badge variant="outline" className="ml-auto">
              Preview
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
          <div className="mx-auto my-auto w-full max-w-2xl text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
              <Bot className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-semibold text-xl">Start with a market question</h2>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground text-sm leading-6">
              The future analyst will use market tools and your watchlist to answer with source context. No AI provider
              is connected in this UI phase.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {prompts.map((prompt) => (
                <Button key={prompt} variant="outline" size="sm" onClick={() => setDraft(prompt)}>
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
          <Alert>
            <LockKeyhole aria-hidden="true" />
            <AlertTitle>Requests are disabled in this preview</AlertTitle>
            <AlertDescription>
              Messages remain in this browser only. No model, market tool, or external provider receives your prompt.
            </AlertDescription>
          </Alert>
          <form onSubmit={handleSubmit} className="relative">
            <label className="sr-only" htmlFor="ai-prompt">
              Ask the MarketPilot Analyst
            </label>
            <Textarea
              id="ai-prompt"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about a market, asset, or your watchlist…"
              className="min-h-24 resize-y pr-14"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-3 bottom-3"
              disabled={!draft.trim()}
              aria-label="Send prompt"
            >
              <ArrowUp />
            </Button>
            <p className="mt-2 text-muted-foreground text-xs">Preview only · prompts are not sent or saved.</p>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4" aria-label="AI data and tool context">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Tool activity</CardTitle>
              <CardDescription>Tools that will ground future answers</CardDescription>
            </div>
            <Wrench className="size-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-dashed p-3 text-center">
              <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-muted">
                <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-2 font-medium text-sm">No tools have run</p>
              <p className="mt-1 text-muted-foreground text-xs">Tool calls begin when the backend is connected.</p>
            </div>
            <ScrollArea className="max-h-56">
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-1">
                {toolNames.map((tool) => (
                  <li key={tool} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
                    <code>{tool}</code>
                    <Badge variant="secondary">Planned</Badge>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Available context</CardTitle>
            <CardDescription>Typed fixture cards · not live sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-sm">
                  <Database className="size-4 text-muted-foreground" aria-hidden="true" />
                  Market snapshot
                </span>
                <Badge variant="outline">Fixture</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Assets</span>
                <span className="text-right">{demoAssets.length} examples</span>
                <span className="text-muted-foreground">BTC sample</span>
                <span className="text-right tabular-nums">{btc ? formatPrice(btc.price) : "Unavailable"}</span>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-sm">
                  <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                  Watchlist
                </span>
                <Badge variant="outline">Local fixture</Badge>
              </div>
              <p className="mt-2 text-muted-foreground text-sm">{defaultWatchlist.join(" · ")}</p>
            </div>
            <div className="rounded-lg border border-dashed p-3">
              <p className="flex items-center gap-2 font-medium text-sm">
                <CircleHelp className="size-4 text-muted-foreground" aria-hidden="true" />
                Source handling
              </p>
              <p className="mt-1 text-muted-foreground text-xs leading-5">
                Market data and news will be validated and labeled with provider and observation time before they reach
                an AI tool.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center gap-2 px-1 text-muted-foreground text-xs">
          <Check className="size-3.5" aria-hidden="true" />
          No external AI or market request was made in this session.
        </div>
      </aside>
    </div>
  );
}
