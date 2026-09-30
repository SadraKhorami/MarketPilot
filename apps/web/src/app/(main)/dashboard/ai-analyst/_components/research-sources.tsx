"use client";
import type { Source } from "@marketpilot/ai/contracts";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { PriceHistoryChart } from "../../_components/price-history-chart";

function display(value: string | number | null, unit: string) {
  if (value === null) return "Unavailable";
  return `${typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 8 }) : value}${unit && unit !== "classification" ? ` ${unit}` : ""}`;
}
export function ResearchSources({ sources }: { sources: Source[] }) {
  // Price and indicator lookups may reference the same observation. Keep the most informative card for it.
  const cards = new Map<string, Source>();
  for (const source of sources) {
    if (source.kind === "proposal") continue;
    const key =
      source.kind === "market" && source.status !== "unavailable"
        ? `${source.symbol}:${source.interval}:${source.windowStart}:${source.windowEnd}`
        : source.id;
    const previous = cards.get(key);
    if (!previous || previous.facts.length < source.facts.length) cards.set(key, source);
  }
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      {[...cards.values()].map((source) => (
        <Card key={source.id} size="sm" id={`source-${source.id}`}>
          <CardHeader>
            <CardTitle>{source.title}</CardTitle>
            <CardDescription>
              {source.source} · {source.interval ? `${source.interval} candles` : "Stored source"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={source.status === "unavailable" ? "destructive" : "outline"}>
                {{ ok: "Observed", partial: "Limited history", unavailable: "Unavailable" }[source.status]}
              </Badge>
              {source.freshness !== "not_applicable" ? (
                <Badge variant="secondary">
                  {{ fresh: "Fresh retrieval", stale: "Stale cache", stored: "Stored news" }[source.freshness]}
                </Badge>
              ) : null}
            </div>
            {source.facts.length ? (
              <dl className="grid grid-cols-2 gap-3">
                {source.facts.slice(0, 4).map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-muted-foreground text-xs">{fact.label}</dt>
                    <dd className="mt-1 break-words font-medium text-sm tabular-nums">
                      {display(fact.value, fact.unit)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {source.error ? <p className="text-muted-foreground text-xs">{source.error}</p> : null}
            {source.excerpt ? <p className="text-muted-foreground text-sm">{source.excerpt}</p> : null}
            {source.observedAt ? (
              <p className="text-muted-foreground text-xs">
                {source.kind === "news" ? "Published" : "Observed trade"}:{" "}
                {new Date(source.observedAt).toLocaleString()}
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">Retrieved: {new Date(source.fetchedAt).toLocaleString()}</p>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
              >
                Read original source <ExternalLink className="size-3" />
              </a>
            ) : null}
            {source.facts.length > 4 || source.history.length ? (
              <details className="min-w-0">
                <summary className="cursor-pointer text-sm">Technical detail and observed window</summary>
                <div className="mt-3 flex min-w-0 flex-col gap-3">
                  {source.windowStart && source.windowEnd ? (
                    <p className="text-muted-foreground text-xs">
                      {new Date(source.windowStart).toLocaleString()} — {new Date(source.windowEnd).toLocaleString()} ·{" "}
                      {source.history.length} observed candles
                    </p>
                  ) : null}
                  {source.history.length > 1 ? (
                    <PriceHistoryChart
                      data={source.history.map((point) => ({
                        time: new Date(point.time).toLocaleString(),
                        price: point.price,
                      }))}
                      quoteCurrency={source.symbol?.split("-")[1] ?? "USD"}
                    />
                  ) : null}
                  <dl className="flex flex-col gap-2">
                    {source.facts.slice(4).map((fact) => (
                      <div key={fact.label} className="flex flex-wrap justify-between gap-2 text-xs">
                        <dt className="text-muted-foreground">{fact.label}</dt>
                        <dd className="tabular-nums">{display(fact.value, fact.unit)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
            ) : null}
            <details>
              <summary className="cursor-pointer text-muted-foreground text-xs">Source reference</summary>
              <p className="mt-2 break-all text-muted-foreground text-xs">{source.id}</p>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
