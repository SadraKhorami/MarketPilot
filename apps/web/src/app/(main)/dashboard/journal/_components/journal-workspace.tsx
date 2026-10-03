"use client";
import { useEffect, useState } from "react";

import Link from "next/link";

import type { JournalRecord, TradePreferences } from "@marketpilot/ai/contracts";
import { BookOpen, Search, Settings2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { chartPrice } from "../../_components/market-chart-utils";
import { MarketDetailsLink } from "../../_components/market-details-link";
import { MarketPilotPage } from "../../_components/marketpilot-page";
import { ResourceState } from "../../_components/resource-state";
import { JournalDetails, journalProfit } from "./journal-details";
import { JournalPreferences } from "./journal-preferences";
export function JournalWorkspace() {
  const preferences = useApiResource<TradePreferences>("/journal/preferences");
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("entry");
    if (id && /^[a-f0-9-]{36}$/i.test(id)) setSelected(id);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const entries = useApiResource<PagedResult<JournalRecord>>(
    `/journal?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(debounced)}${status === "all" ? "" : `&status=${status}`}`,
    { keepDataOnReload: true },
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") entries.reload();
    }, 65_000);
    const change = () => entries.reload();
    window.addEventListener("marketpilot:journal-changed", change);
    return () => {
      clearInterval(timer);
      window.removeEventListener("marketpilot:journal-changed", change);
    };
  }, [entries.reload]);
  return (
    <MarketPilotPage
      title="Journal"
      description="Turn a market idea into a plan. Record your execution and learn from the outcome."
      actions={
        <>
          <Button
            variant="outline"
            disabled={!preferences.data}
            onClick={() => setSettings(true)}
            aria-label="Trading preferences"
          >
            <Settings2 data-icon="inline-start" />
            Trading memory
          </Button>
          <Button asChild>
            <Link href="/dashboard/ai-analyst">
              <Sparkles data-icon="inline-start" />
              New AI plan
            </Link>
          </Button>
        </>
      }
    >
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Trading memory</CardTitle>
          <CardDescription>
            Used as a starting point in AI chat. Every new plan still asks for confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <ResourceState
            loading={preferences.loading}
            error={preferences.error}
            title="Preferences unavailable"
            retry={preferences.reload}
          />
          {preferences.data ? (
            <>
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  [
                    "Capital",
                    preferences.data.capital
                      ? `${chartPrice(preferences.data.capital)} ${preferences.data.currency}`
                      : "Not supplied",
                  ],
                  ["Risk limit", `${preferences.data.riskPercent}% per trade`],
                  ["Timeframe", `${preferences.data.interval} · ${preferences.data.holding}`],
                  ["AI event comments", preferences.data.autoReview ? "On · uses allowance" : "Off"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground text-xs">{label}</dt>
                    <dd className="mt-1 font-medium text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </CardContent>
      </Card>
      <Card className="overflow-hidden shadow-none">
        <CardHeader>
          <CardTitle>Your plans & trades</CardTitle>
          <CardDescription>
            Price touches are observations. Only your confirmation records an actual entry or exit.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <InputGroup className="w-full sm:w-80">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search market"
                aria-label="Search journal"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Journal status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {["all", "planned", "open", "closed", "cancelled", "expired"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "all" ? "All entries" : value[0].toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <ResourceState
            loading={entries.loading}
            error={entries.error}
            title="Journal unavailable"
            retry={entries.reload}
          />
          {entries.data?.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Market / side</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entry / SL</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead>Recorded result</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.data.items.map((entry) => {
                  const profit = journalProfit(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-6">
                        <span className="font-medium">{entry.symbol}</span>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {entry.plan.direction === "BUY" ? "Long" : "Short"} · {entry.plan.interval} ·{" "}
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "open" ? "default" : "outline"}>{entry.status}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {chartPrice(entry.plan.entry)}
                        <p className="mt-1 text-muted-foreground text-xs">
                          SL {chartPrice(entry.plan.stopLoss)} {entry.plan.quote}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span>
                          {entry.plan.targets.length} target{entry.plan.targets.length > 1 ? "s" : ""}
                        </span>
                        <p className="mt-1 text-muted-foreground text-xs">{entry.context.riskPercent}% risk limit</p>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {profit === null ? "—" : `${profit >= 0 ? "+" : ""}${chartPrice(profit)} ${entry.plan.quote}`}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <MarketDetailsLink symbol={entry.symbol} />
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Open ${entry.symbol} journal details`}
                            onClick={() => setSelected(entry.id)}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : !entries.loading && !entries.error ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>
                  {debounced || status !== "all" ? "No matching entries" : "Your first plan starts in AI chat"}
                </EmptyTitle>
                <EmptyDescription>
                  {debounced || status !== "all"
                    ? "Try another market or status."
                    : "Choose Entry, stop loss & targets, confirm your context, then save the plan here."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/ai-analyst">Create an AI plan</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : null}
        </CardContent>
        {entries.data ? (
          <CollectionPagination
            page={page}
            pageSize={pageSize}
            total={entries.data.total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </Card>
      {settings && preferences.data ? (
        <JournalPreferences initial={preferences.data} close={() => setSettings(false)} saved={preferences.reload} />
      ) : null}
      {selected ? (
        <JournalDetails key={selected} id={selected} close={() => setSelected(null)} changed={entries.reload} />
      ) : null}
    </MarketPilotPage>
  );
}
