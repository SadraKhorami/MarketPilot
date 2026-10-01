"use client";
import { useEffect, useState } from "react";

import { BellRing, Eye, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { CollectionSearch, FilterSelect } from "../../_components/collection-filters";
import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import { AlertDetails } from "./alert-details";
import { type AlertRecord, conditionLabel, dateLabel, reasonLabel } from "./alert-types";
import { CreateAlert } from "./create-alert";
export function AlertManager() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status, search });
  const resource = useApiResource<PagedResult<AlertRecord>>(`/alerts?${query}`, { keepDataOnReload: true });
  useEffect(() => {
    setSelected(new URLSearchParams(window.location.search).get("alert"));
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") resource.reload();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [resource.reload]);
  useEffect(() => {
    if (resource.data && page > Math.max(1, resource.data.totalPages)) setPage(Math.max(1, resource.data.totalPages));
  }, [resource.data, page]);
  async function mutate(rule: AlertRecord, action: "toggle" | "delete") {
    if (busy) return;
    setBusy(rule.id);
    try {
      await apiRequest(`/alerts/${rule.id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        ...(action === "toggle" ? { body: JSON.stringify({ enabled: !rule.enabled }) } : {}),
      });
      if (action === "delete" && selected === rule.id) setSelected(null);
      resource.reload();
      const message = rule.enabled ? "Alert paused." : "Alert resumed. Waiting for a fresh baseline.";
      toast.success(action === "delete" ? "Alert deleted." : message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this alert.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Card>
        <CardHeader className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <CardTitle>Alert rules</CardTitle>
            <CardDescription>
              Crossing-based rules · Dashboard inbox delivery · Fresh provider observations
            </CardDescription>
          </div>
          <CreateAlert
            saved={() => {
              setPage(1);
              resource.reload();
            }}
          />
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <CollectionSearch
                value={search}
                placeholder="Search name or market"
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
            </div>
            <FilterSelect
              label="Rule status"
              value={status}
              options={[
                ["all", "All rules"],
                ["active", "Active"],
                ["paused", "Paused"],
              ]}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </div>
          <ResourceState {...resource} retry={resource.reload} />
          {!resource.loading && !resource.error && resource.data ? (
            <>
              {resource.data.items.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Evaluation</TableHead>
                        <TableHead>Last trigger</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resource.data.items.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <p className="max-w-56 truncate font-medium" title={rule.name}>
                              {rule.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {rule.assetId} · {rule.interval}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p>{conditionLabel(rule)}</p>
                            <p className="text-muted-foreground text-xs">{rule.cooldownMinutes}m cooldown · Inbox</p>
                          </TableCell>
                          <TableCell>
                            <p>{reasonLabel(rule.evaluationReason)}</p>
                            <p className="text-muted-foreground text-xs">{dateLabel(rule.lastEvaluatedAt)}</p>
                          </TableCell>
                          <TableCell className="text-xs">{dateLabel(rule.lastTriggeredAt)}</TableCell>
                          <TableCell>
                            <Badge variant={rule.enabled ? "default" : "outline"}>
                              {rule.enabled ? "Active" : "Paused"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`View ${rule.name}`}
                                onClick={() => setSelected(rule.id)}
                              >
                                <Eye />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busy !== null}
                                aria-label={`${rule.enabled ? "Pause" : "Resume"} ${rule.name}`}
                                onClick={() => void mutate(rule, "toggle")}
                              >
                                {rule.enabled ? <Pause /> : <Play />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busy !== null}
                                aria-label={`Delete ${rule.name}`}
                                onClick={() => void mutate(rule, "delete")}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BellRing />
                    </EmptyMedia>
                    <EmptyTitle>{search || status !== "all" ? "No matching rules" : "No alert rules yet"}</EmptyTitle>
                    <EmptyDescription>
                      {search || status !== "all"
                        ? "Adjust the search or status filter."
                        : "Create a rule to monitor price, RSI or the percentage change of a completed candle."}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              <CollectionPagination
                page={page}
                pageSize={pageSize}
                total={resource.data.total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
              <p className="text-muted-foreground text-xs">
                Times use your device timezone. The first observation sets a baseline; a new notification requires a
                crossing after the condition has reset. Paused rules are not evaluated.
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
      <AlertDetails key={selected ?? "closed"} id={selected} close={() => setSelected(null)} />
    </>
  );
}
