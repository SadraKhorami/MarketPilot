"use client";
import { X, SlidersHorizontal, TrendingUp, Target, Wallet, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { localDate } from "./journal-dates";
import { JournalDatePicker } from "./journal-date-picker";
import { JournalPerformanceChart } from "./journal-performance-chart";
import { useState } from "react";
import type { JournalAnalytics } from "@marketpilot/ai/contracts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useApiResource } from "@/hooks/use-api-resource";
import { MarketPilotPage } from "../../_components/marketpilot-page";
import { MarketSymbolField } from "../../_components/market-symbol-field";
import { ResourceState } from "../../_components/resource-state";
import { journalMoney } from "./journal-money";
export function JournalAnalyticsWorkspace() {
  const currencies = useApiResource<string[]>("/journal/currencies");
  const [chartMode, setChartMode] = useState("cumulative");
  const [range, setRange] = useState("7");
  const [basis, setBasis] = useState("estimated");
  const [symbol, setSymbol] = useState("");
  const [source, setSource] = useState("all");
  const [quote, setQuote] = useState("USD");
  const [from, setFrom] = useState(() => localDate(new Date(Date.now() - 6 * 86400_000)).slice(0, 10));
  const [to, setTo] = useState(() => localDate(new Date()).slice(0, 10));
  const now = new Date();
  const start =
    range === "custom"
      ? from
        ? new Date(`${from}T00:00:00`)
        : null
      : range === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getTime() - Number(range) * 86400_000);
  const end = range === "custom" && to ? new Date(`${to}T23:59:59.999`) : now;
  const query = new URLSearchParams({
    basis,
    quote,
    ...(start ? { from: start.toISOString() } : {}),
    to: end.toISOString(),
    ...(symbol ? { symbol } : {}),
    ...(source !== "all" ? { source } : {}),
  });
  // Keep relative ranges stable across renders; date keys change only with filter changes.
  query.set(
    "to",
    range === "custom" && to
      ? end.toISOString()
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
  );
  if (range !== "custom" && range !== "month")
    query.set("from", new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(range) + 1).toISOString());
  const validDates = range !== "custom" || (!!from && !!to && from <= to);
  const resource = useApiResource<JournalAnalytics>(validDates ? `/journal/analytics?${query}` : null, {
    keepDataOnReload: true,
  });
  const data = validDates ? resource.data : null;
  const choices = [
    [
      "range",
      "Date range",
      range,
      setRange,
      [
        ["7", "Last 7 days"],
        ["month", "This month"],
        ["30", "Last 30 days"],
        ["custom", "Custom range"],
      ],
    ],
    [
      "basis",
      "Result basis",
      basis,
      setBasis,
      [
        ["recorded", "Manual records"],
        ["estimated", "Simulations"],
      ],
    ],
    [
      "source",
      "Source",
      source,
      setSource,
      [
        ["all", "All sources"],
        ["manual", "Manual"],
        ["ai", "AI plans"],
        ["import", "Imported"],
      ],
    ],
    [
      "quote",
      "Report currency",
      quote,
      setQuote,
      [...new Set(["USD", "EUR", "GBP", "USDT", ...(currencies.data ?? [])])].map((value) => [value, value] as const),
    ],
  ] as const;
  const filters = [
    {
      id: "range",
      label:
        range === "custom"
          ? `${from || "Start"} – ${to || "End"}`
          : (choices[0][4].find(([value]) => value === range)?.[1] ?? range),
      changed: range !== "7",
      reset: () => setRange("7"),
    },
    {
      id: "basis",
      label: basis === "recorded" ? "Manual records" : "Simulations",
      changed: basis !== "estimated",
      reset: () => setBasis("estimated"),
    },
    { id: "quote", label: quote, changed: quote !== "USD", reset: () => setQuote("USD") },
    ...(source !== "all"
      ? [
          {
            id: "source",
            label: choices[2][4].find(([value]) => value === source)?.[1] ?? source,
            changed: true,
            reset: () => setSource("all"),
          },
        ]
      : []),
    ...(symbol ? [{ id: "market", label: symbol, changed: true, reset: () => setSymbol("") }] : []),
  ];
  const activeCount = filters.filter((filter) => filter.changed).length;
  function resetFilters() {
    setRange("7");
    setBasis("estimated");
    setQuote("USD");
    setSource("all");
    setSymbol("");
    setFrom(localDate(new Date(Date.now() - 6 * 86400_000)).slice(0, 10));
    setTo(localDate(new Date()).slice(0, 10));
  }
  return (
    <MarketPilotPage title="Journal analytics" description="Understand your results, consistency and trading costs.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-muted-foreground text-sm" aria-live="polite">
          {filters.map((filter) => filter.label).join(" · ")}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal data-icon="inline-start" />
              Filters{activeCount ? ` · ${activeCount}` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 max-w-[calc(100vw-2rem)] gap-4 p-4"
            aria-label="Performance filters"
          >
            <PopoverHeader>
              <PopoverTitle>Performance filters</PopoverTitle>
              <PopoverDescription>Changes update your report automatically.</PopoverDescription>
            </PopoverHeader>
            <FieldGroup className="max-h-[65vh] gap-4 overflow-y-auto">
              {choices.map(([id, label, value, setter, options]) => (
                <Field key={id}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={`analytics-${id}`}>{label}</FieldLabel>
                    {filters.find((filter) => filter.id === id && filter.changed) ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Reset ${label.toLowerCase()}`}
                        title={`Reset ${label.toLowerCase()}`}
                        onClick={() => filters.find((filter) => filter.id === id)?.reset()}
                      >
                        <X />
                      </Button>
                    ) : null}
                  </div>
                  <Select value={value} onValueChange={setter}>
                    <SelectTrigger id={`analytics-${id}`} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {options.map(([v, text]) => (
                          <SelectItem key={v} value={v}>
                            {text}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {id === "range" && range === "custom" ? (
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="analytics-from">From</FieldLabel>
                        <JournalDatePicker
                          id="analytics-from"
                          dateOnly
                          value={from}
                          max={to || undefined}
                          onChange={setFrom}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="analytics-to">To</FieldLabel>
                        <JournalDatePicker
                          id="analytics-to"
                          dateOnly
                          value={to}
                          min={from || undefined}
                          onChange={setTo}
                        />
                      </Field>
                    </FieldGroup>
                  ) : null}
                </Field>
              ))}
              <Field>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="analytics-market">Market</FieldLabel>
                  {symbol ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Clear market filter"
                      title="Clear market filter"
                      onClick={() => setSymbol("")}
                    >
                      <X />
                    </Button>
                  ) : null}
                </div>
                <MarketSymbolField id="analytics-market" value={symbol} onChange={setSymbol} allowAll compact />
              </Field>
            </FieldGroup>
            {!validDates ? (
              <p role="alert" className="text-destructive text-xs">
                Choose a start and end date in chronological order.
              </p>
            ) : null}
            <Button variant="ghost" size="sm" disabled={!activeCount} onClick={resetFilters} className="self-end">
              Reset filters
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        title="Performance unavailable"
        retry={resource.reload}
      />
      {data ? (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              {[
                [
                  "Realised net P&L",
                  `${journalMoney(data.net)} ${data.quote}`,
                  "Profit from exits after fees · excludes unrealised P&L",
                ],
                [
                  "Win rate",
                  data.winRate === null ? "—" : `${data.winRate.toFixed(1)}%`,
                  `${data.wins} wins · ${data.losses} losses · ${data.closedTrades} closed`,
                ],
                [
                  "Average closed trade",
                  data.average === null ? "—" : `${journalMoney(data.average)} ${data.quote}`,
                  "Full lifetime result of trades closed in this period",
                ],
                [
                  "Fees",
                  `${journalMoney(data.fees)} ${data.quote}`,
                  `Allocated to exits in this period · ${data.openTrades} currently open`,
                ],
              ].map(([label, value, detail], index) => (
                <Card key={label} className="rounded-none ring-0">
                  <CardHeader>
                    <CardDescription className="flex items-center justify-between gap-2">
                      {label}
                      {[TrendingUp, Target, Activity, Wallet].map((Icon, i) =>
                        i === index ? <Icon key={label} className="size-4" /> : null,
                      )}
                    </CardDescription>
                    <CardTitle className="tabular-nums text-2xl">{value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-xs">{detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Performance over time</CardTitle>
                  <Tabs value={chartMode} onValueChange={setChartMode}>
                    <TabsList>
                      <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
                      <TabsTrigger value="net">Daily</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <CardDescription>
                  {data.basis === "estimated"
                    ? "Candle-based simulations. Monetary results require a supplied position amount."
                    : "Manual records. Partial exits contribute on their exit dates."}{" "}
                  Days are grouped in UTC.{" "}
                  {data.unsizedTrades
                    ? `${data.unsizedTrades} unsized simulations are excluded from monetary P&L.`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.series.length ? (
                  <JournalPerformanceChart data={data} mode={chartMode} />
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>No realised exits in this period</EmptyTitle>
                      <EmptyDescription>
                        Choose another range or result basis. Waiting, expired and cancelled plans have no realised P&L.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Trade outcomes</CardTitle>
                <CardDescription>Trades closed within this period</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-4xl font-semibold tabular-nums">
                    {data.winRate === null ? "—" : `${data.winRate.toFixed(1)}%`}
                  </span>
                  <span className="text-muted-foreground text-sm">win rate</span>
                </div>
                <Progress value={data.winRate ?? 0} aria-label="Win rate" />
                <dl className="flex flex-col gap-3 text-sm">
                  {[
                    ["Winning", data.wins],
                    ["Losing", data.losses],
                    ["Break-even", data.closedTrades - data.wins - data.losses],
                    ["Still open", data.openTrades],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-muted-foreground text-xs">Profit factor</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {data.profitFactor === null ? "—" : data.profitFactor.toFixed(2)}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">Winning results divided by losing results.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </MarketPilotPage>
  );
}
