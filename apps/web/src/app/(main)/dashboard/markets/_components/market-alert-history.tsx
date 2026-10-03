"use client";

import { type ReactNode, useEffect, useState } from "react";

import type { JournalRecord } from "@marketpilot/ai/contracts";
import type { MarketObservation } from "@marketpilot/market-data";

import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks/use-api-resource";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import type { PagedResult } from "../../_components/collection-pagination";
import { MarketHistoryPanel } from "../../_components/market-history-panel";
import { AlertDetails } from "../../alerts/_components/alert-details";
import type { AlertRecord } from "../../alerts/_components/alert-types";
import { JournalDetails } from "../../journal/_components/journal-details";

export function MarketAlertHistory({
  data,
  stale,
  status,
}: {
  data: MarketObservation;
  stale: boolean;
  status?: ReactNode;
}) {
  const journal = useApiResource<PagedResult<JournalRecord>>(
    `/journal?symbol=${encodeURIComponent(data.symbol)}&pageSize=50`,
    { keepDataOnReload: true },
  );
  const [journalSelected, setJournalSelected] = useState<string | null>(null);
  useEffect(() => {
    const reload = () => journal.reload();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 65_000);
    window.addEventListener("marketpilot:journal-changed", reload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("marketpilot:journal-changed", reload);
    };
  }, [journal.reload]);
  const [result, setResult] = useState<{ symbol: string; revision: number; alerts: AlertRecord[] }>({
    symbol: "",
    revision: -1,
    alerts: [],
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const alerts: AlertRecord[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const { data: response } = await apiRequest<ApiEnvelope<PagedResult<AlertRecord>>>(
            `/alerts?assetId=${encodeURIComponent(data.symbol)}&page=${page}&pageSize=50`,
            { signal: controller.signal },
          );
          alerts.push(...response.items.filter((rule) => rule.assetId === data.symbol));
          totalPages = response.totalPages;
          page++;
        } while (page <= totalPages && !controller.signal.aborted);
        if (!controller.signal.aborted) {
          setResult({ symbol: data.symbol, revision, alerts });
          setError(null);
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Alerts could not be loaded.");
      } finally {
        running = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("marketpilot:alerts-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("marketpilot:alerts-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [data.symbol, revision]);
  return (
    <>
      <MarketHistoryPanel
        data={data}
        journal={journal.data?.items.filter((item) => item.symbol === data.symbol) ?? []}
        onJournalSelect={setJournalSelected}
        stale={stale}
        status={
          <>
            {status}
            {journal.error ? (
              <Button variant="outline" size="sm" onClick={journal.reload}>
                Retry journal layer
              </Button>
            ) : null}
          </>
        }
        alerts={result.symbol === data.symbol && result.revision === revision && !error ? result.alerts : []}
        onAlertSelect={setSelected}
        alertStatus={
          error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
              <span>Market alerts unavailable.</span>
              <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
                Try again
              </Button>
            </div>
          ) : loading ? (
            <p role="status" className="text-muted-foreground text-xs">
              Loading market alerts…
            </p>
          ) : undefined
        }
      />
      {journalSelected ? (
        <JournalDetails
          key={journalSelected}
          id={journalSelected}
          close={() => setJournalSelected(null)}
          changed={journal.reload}
        />
      ) : null}
      <AlertDetails key={selected ?? "closed"} id={selected} close={() => setSelected(null)} presentation="sheet" />
    </>
  );
}
