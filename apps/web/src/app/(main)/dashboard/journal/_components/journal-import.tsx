"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ManualTrade } from "@marketpilot/ai/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_BASE, apiRequest, type ApiEnvelope } from "@/lib/api/client";
import { CollectionPagination } from "../../_components/collection-pagination";
const columns = [
  ["symbol", "Market pair", true],
  ["direction", "Long / short", true],
  ["status", "Status", true],
  ["startedAt", "Entry / plan time", true],
  ["entry", "Entry price", true],
  ["stopLoss", "Stop loss", true],
  ["targets", "Targets (array or comma-separated)", true],
  ["quantity", "Quantity", true],
  ["interval", "Timeframe", false],
  ["expiresAt", "Plan valid until", false],
  ["closedAt", "Exit time", false],
  ["exitPrice", "Exit price", false],
  ["fees", "Fees", false],
  ["notes", "Notes", false],
  ["targetAllocations", "Target exit %", false],
] as const;
type Preview = { row: number; trade: ManualTrade | null; duplicate: boolean; error: string | null };
function iso(value: unknown, timezone: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "Invalid date · use ISO format";
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(explicit || timezone === "local" ? value : `${value}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "Invalid date";
}
function numbers(value: unknown) {
  if (Array.isArray(value)) return value.map(Number);
  return String(value ?? "")
    .split(/[,;]/)
    .filter((v) => v.trim())
    .map(Number);
}
export function JournalImport({
  close,
  changed,
  embedded = false,
  initialFile,
}: {
  close: () => void;
  changed: (summary?: { added: number; skipped: number }) => void;
  embedded?: boolean;
  initialFile?: File;
}) {
  const uploaded = useRef(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [interval, setInterval] = useState("15m");
  const [timezone, setTimezone] = useState("UTC");
  const [validityHours, setValidityHours] = useState("24");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = useCallback(
    async (file?: File) => {
      if (!file || pending) return;
      setPending(true);
      setError(null);
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error("Choose a file under 2 MB.");
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(`${API_BASE}/journal/import/file`, {
          method: "POST",
          body,
          credentials: "include",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? result.message ?? "File could not be read.");
        const data = result.data as { rows: Record<string, unknown>[]; columns: string[] };
        setRows(data.rows);
        setHeaders(data.columns);
        setPreview(null);
        const matched: Record<string, string> = {};
        for (const [key] of columns) {
          const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
          const match = data.columns.find((h) => h.toLowerCase().replace(/[^a-z]/g, "") === normalized);
          if (match) matched[key] = match;
        }
        setMapping(matched);
        setMappingOpen(columns.some(([key, , required]) => required && !matched[key]));
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "File unavailable.");
      } finally {
        setPending(false);
      }
    },
    [pending],
  );
  useEffect(() => {
    if (initialFile && !uploaded.current) {
      uploaded.current = true;
      void upload(initialFile);
    }
  }, [initialFile, upload]);
  async function review() {
    setPending(true);
    setError(null);
    try {
      const hours = Number(validityHours);
      if (!(hours > 0 && hours <= 720)) throw new Error("Default validity must be between 1 and 720 hours.");
      const normalized = rows.map((row) => {
        const get = (key: string) => (mapping[key] ? row[mapping[key]] : undefined);
        const targets = numbers(get("targets"));
        const supplied = numbers(get("targetAllocations"));
        const allocations = supplied.length ? supplied : targets.map(() => 100 / targets.length);
        const statusText = String(get("status") ?? "")
          .toLowerCase()
          .trim();
        const direction = String(get("direction") ?? "")
          .toUpperCase()
          .trim();
        const startedAt = iso(get("startedAt"), timezone);
        const expiresAt = get("expiresAt")
          ? iso(get("expiresAt"), timezone)
          : Number.isFinite(Date.parse(startedAt))
            ? new Date(Date.parse(startedAt) + hours * 3600_000).toISOString()
            : "Invalid date";
        const closed = ["closed", "tp", "sl", "take profit", "stop loss"].includes(statusText);
        return {
          symbol: String(get("symbol") ?? ""),
          direction: direction === "LONG" ? "BUY" : direction === "SHORT" ? "SELL" : direction,
          status: closed ? "closed" : statusText,
          interval: String(get("interval") ?? interval),
          entry: Number(get("entry")),
          stopLoss: Number(get("stopLoss")),
          quantity: Number(get("quantity")),
          fees: Number(get("fees") ?? 0),
          targets,
          targetAllocations: allocations,
          startedAt,
          expiresAt,
          closedAt: closed ? iso(get("closedAt"), timezone) : null,
          exitPrice: closed ? Number(get("exitPrice")) : null,
          exitReason:
            statusText === "sl" || statusText === "stop loss"
              ? "sl"
              : statusText === "tp" || statusText === "take profit"
                ? "tp"
                : "manual",
          trackingMode: "observed",
          entryTrigger: "touch",
          notes: String(get("notes") ?? ""),
        };
      });
      const result = await apiRequest<ApiEnvelope<Preview[]>>("/journal/import/preview", {
        method: "POST",
        body: JSON.stringify(normalized),
      });
      setPreview(result.data);
      setSelected(result.data.filter((r) => r.trade && !r.error && !r.duplicate).map((r) => r.row));
      setPage(1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Preview unavailable.");
    } finally {
      setPending(false);
    }
  }
  async function commit() {
    if (!preview || !selected.length) return;
    setPending(true);
    setError(null);
    try {
      const result = await apiRequest<ApiEnvelope<{ added: number; skipped: number }>>("/journal/import/confirm", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          rows: preview
            .filter((row) => selected.includes(row.row) && row.trade && !row.duplicate)
            .map((row) => row.trade),
        }),
      });
      changed(result.data);
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Import could not be saved.");
    } finally {
      setPending(false);
    }
  }
  const content = (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        {!preview ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="journal-file">Choose file</FieldLabel>
              <Input
                id="journal-file"
                type="file"
                accept=".xlsx,.json"
                disabled={pending}
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <FieldDescription>
                Excel: first worksheet, first row contains column names. Dates: ISO format (YYYY-MM-DD HH:mm). Times
                without an offset use the selected clock.
              </FieldDescription>
            </Field>
            {rows.length ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    {rows.length} trades · {columns.filter(([key]) => mapping[key]).length} matched columns
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-expanded={mappingOpen}
                    onClick={() => setMappingOpen(!mappingOpen)}
                  >
                    Column mapping
                  </Button>
                </div>
                {mappingOpen ? (
                  <FieldGroup className="grid gap-3 sm:grid-cols-2">
                    {columns.map(([key, label, required]) => (
                      <Field key={key}>
                        <FieldLabel htmlFor={`map-${key}`}>
                          {label}
                          {required ? " *" : ""}
                        </FieldLabel>
                        <Select
                          value={mapping[key] ?? "none"}
                          onValueChange={(v) => setMapping((all) => ({ ...all, [key]: v === "none" ? "" : v }))}
                        >
                          <SelectTrigger id={`map-${key}`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">{required ? "Choose column" : "Use default / empty"}</SelectItem>
                              {headers.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    ))}
                    <Field>
                      <FieldLabel htmlFor="import-interval">Default timeframe</FieldLabel>
                      <Select value={interval} onValueChange={setInterval}>
                        <SelectTrigger id="import-interval" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {["1m", "5m", "15m", "1h", "6h", "1d"].map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="import-zone">File clock</FieldLabel>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger id="import-zone" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="UTC">Universal clock</SelectItem>
                            <SelectItem value="local">My device clock</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="import-validity">Default plan validity · hours</FieldLabel>
                      <Input
                        id="import-validity"
                        type="number"
                        min="1"
                        max="720"
                        value={validityHours}
                        onChange={(e) => setValidityHours(e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  Missing fees default to zero. Missing allocations split equally across targets. Imported trades use
                  observation-only tracking. Closed trades require exit price and time.
                </p>
              </>
            ) : null}
          </FieldGroup>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">
                {selected.length} selected · {preview.filter((r) => r.duplicate).length} duplicates ·{" "}
                {preview.filter((r) => r.error).length} invalid
              </p>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setPreview(null)}>
                Edit mapping
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Select</TableHead>
                  <TableHead>Row / market</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice((page - 1) * pageSize, page * pageSize).map((row) => (
                  <TableRow key={row.row}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Import row ${row.row}`}
                        disabled={pending || !row.trade || row.duplicate || !!row.error}
                        checked={selected.includes(row.row)}
                        onCheckedChange={(checked) =>
                          setSelected((ids) =>
                            checked === true ? [...ids, row.row] : ids.filter((n) => n !== row.row),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {row.row} · {row.trade?.symbol ?? "Invalid trade"}
                      <p className="text-muted-foreground text-xs">
                        {row.trade ? `${row.trade.direction} · ${row.trade.status} · ${row.trade.entry}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-sm">
                      {row.error ?? (row.duplicate ? "Already recorded · skipped" : "Ready to import")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <CollectionPagination
              page={page}
              pageSize={pageSize}
              total={preview.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t p-4">
        <Button variant="ghost" disabled={pending} onClick={close}>
          Cancel
        </Button>
        {preview ? (
          <Button disabled={pending || !selected.length} onClick={() => void commit()}>
            {pending ? "Importing…" : `Confirm & import ${selected.length} trades`}
          </Button>
        ) : (
          <Button
            disabled={pending || !rows.length || columns.some(([key, , required]) => required && !mapping[key])}
            onClick={() => void review()}
          >
            {pending ? "Reading…" : "Preview import"}
          </Button>
        )}
      </div>
    </>
  );
  if (embedded)
    return (
      <section aria-label="Import attachment" className="flex flex-col gap-3 rounded-xl border py-4">
        {content}
      </section>
    );
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Import journal</SheetTitle>
          <SheetDescription>
            Excel .xlsx or a JSON array · one row per trade, up to 200 trades. Nothing is saved until you confirm.
          </SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
