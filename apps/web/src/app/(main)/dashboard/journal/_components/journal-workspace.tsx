"use client";
import { useEffect, useState } from "react";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import { BookOpen, Search, Plus, FileUp, Sparkles } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
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
import { AddTrade } from "./add-trade";
import { JournalActions } from "./journal-actions";
import { JournalImport } from "./journal-import";
import { JournalAssistant } from "./journal-assistant";
import { JournalSelectionActions } from "./journal-selection-actions";
import { journalMoney } from "./journal-money";

export function JournalWorkspace() {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [source, setSource] = useState("all");
  const [archived, setArchived] = useState("false");
  const [selectedRows, setSelectedRows] = useState<{ filters: string; ids: string[] }>({ filters: "", ids: [] });
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
  const filters = new URLSearchParams({
    search: debounced,
    archived,
    ...(status !== "all" ? { status } : {}),
    ...(source !== "all" ? { source } : {}),
  }).toString();
  const selection = selectedRows.filters === filters ? selectedRows.ids : [];
  function setSelection(update: (ids: string[]) => string[]) {
    setSelectedRows((previous) => ({
      filters,
      ids: update(previous.filters === filters ? previous.ids : []),
    }));
  }
  const entries = useApiResource<PagedResult<JournalRecord>>(`/journal?page=${page}&pageSize=${pageSize}&${filters}`, {
    keepDataOnReload: true,
  });
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
      description="Track manual trades, imported executions and AI plans in one journal."
      actions={
        <>
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileUp data-icon="inline-start" />
            Import
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Journal assistant"
            title="Journal assistant"
            onClick={() => setAssistant(true)}
          >
            <Sparkles />
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Add trade
          </Button>
        </>
      }
    >
      <Card className="overflow-hidden shadow-none">
        <CardHeader>
          <CardTitle>Your plans & trades</CardTitle>
          <CardDescription>
            Track simulated positions and manually recorded trades. Select rows for AI review, archiving or deletion.
          </CardDescription>
          <div className="flex flex-wrap items-start justify-between gap-3 pt-2">
            <div className="flex w-full min-w-0 flex-wrap gap-2 sm:flex-1">
              <InputGroup className="w-full sm:w-56">
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
                <SelectTrigger className="w-full sm:w-36" aria-label="Journal status">
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
              <Select
                value={source}
                onValueChange={(v) => {
                  setSource(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-36" aria-label="Trade source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[
                      ["all", "All sources"],
                      ["manual", "Manual"],
                      ["ai", "AI"],
                      ["import", "Imported"],
                    ].map(([v, text]) => (
                      <SelectItem key={v} value={v}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={archived}
                onValueChange={(v) => {
                  setArchived(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-36" aria-label="Journal archive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="false">Active journal</SelectItem>
                    <SelectItem value="true">Archived</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {selection.length ? (
              <JournalSelectionActions
                ids={selection}
                archived={archived === "true"}
                ask={() => setAssistant(true)}
                completed={(ids) => {
                  setSelection((selected) => selected.filter((id) => !ids.includes(id)));
                  entries.reload();
                }}
              />
            ) : null}
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
                  <TableHead className="pl-6">
                    <Checkbox
                      aria-label="Select trades on this page"
                      checked={
                        !!entries.data?.items.length && entries.data.items.every((e) => selection.includes(e.id))
                      }
                      onCheckedChange={(checked) =>
                        setSelection((ids) =>
                          checked === true
                            ? [...new Set([...ids, ...(entries.data?.items.map((e) => e.id) ?? [])])].slice(0, 50)
                            : ids.filter((id) => !entries.data?.items.some((e) => e.id === id)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Market / side</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entry / SL</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead>Realised P&amp;L</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.data.items.map((entry) => {
                  const profit = journalProfit(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-6">
                        <Checkbox
                          aria-label={`Select ${entry.symbol} trade`}
                          checked={selection.includes(entry.id)}
                          disabled={!selection.includes(entry.id) && selection.length >= 50}
                          onCheckedChange={(checked) =>
                            setSelection((ids) =>
                              checked === true ? [...ids, entry.id] : ids.filter((id) => id !== entry.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{entry.symbol}</span>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {entry.plan.direction === "BUY" ? "Long" : "Short"} · {entry.plan.interval} ·{" "}
                          {new Date(entry.openedAt ?? entry.createdAt).toLocaleDateString()}
                        </p>
                        <span className="text-muted-foreground text-xs">
                          {entry.source === "ai" ? "AI plan" : entry.source === "import" ? "Imported" : "Manual"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === "open" ? "default" : "outline"}>{entry.status}</Badge>
                        {entry.monitoringStatus?.startsWith("Needs review") ? (
                          <p className="mt-1 text-muted-foreground text-xs">Needs review</p>
                        ) : null}
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
                        <p className="mt-1 text-muted-foreground text-xs">
                          {entry.quantity
                            ? `${journalMoney(entry.quantity * (entry.entryPrice ?? entry.plan.entry))} ${entry.plan.quote} position`
                            : `${entry.context.riskPercent}% risk limit`}
                        </p>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {profit === null ? "—" : `${profit >= 0 ? "+" : ""}${journalMoney(profit)} ${entry.plan.quote}`}
                        {profit !== null ? (
                          <p className="mt-1 text-muted-foreground text-xs">
                            {entry.resultBasis === "estimated" ? "Simulated" : "Recorded"}
                            {entry.status === "open" ? " · partial exits" : ""}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <MarketDetailsLink symbol={entry.symbol} />
                          <JournalActions entry={entry} view={() => setSelected(entry.id)} changed={entries.reload} />
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
                  {debounced || status !== "all" ? "No matching entries" : "Start your trading journal"}
                </EmptyTitle>
                <EmptyDescription>
                  {debounced || status !== "all"
                    ? "Try another market or status."
                    : "Add a trade manually, import your existing journal or save an AI plan."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => setAdding(true)}>
                  Add trade
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
      {adding ? <AddTrade close={() => setAdding(false)} saved={entries.reload} /> : null}
      {importing ? <JournalImport close={() => setImporting(false)} changed={entries.reload} /> : null}
      {assistant ? (
        <JournalAssistant
          close={() => setAssistant(false)}
          query={filters}
          selected={selection}
          changed={entries.reload}
        />
      ) : null}
      {selected ? (
        <JournalDetails key={selected} id={selected} close={() => setSelected(null)} changed={entries.reload} />
      ) : null}
    </MarketPilotPage>
  );
}
