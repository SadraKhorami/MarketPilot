"use client";

import { useState } from "react";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import { Archive, ArchiveRestore, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldSet } from "@/components/ui/field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { apiRequest, type ApiEnvelope } from "@/lib/api/client";

export function JournalSelectionActions({
  ids,
  archived,
  ask,
  completed,
}: {
  ids: string[];
  archived: boolean;
  ask: () => void;
  completed: (ids: string[]) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<"delete" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(action: "delete" | "archive") {
    if (pending) return;
    setPending(action);
    setError(null);
    const succeeded: string[] = [];
    const failures: string[] = [];
    for (const id of ids) {
      try {
        if (action === "delete") {
          const response = await apiRequest<ApiEnvelope<JournalRecord>>(`/journal/${id}`);
          const trade = response.data;
          await apiRequest(`/journal/${id}`, {
            method: "DELETE",
            body: JSON.stringify({ confirm: true, updatedAt: trade.updatedAt, editVersion: trade.editVersion }),
          });
        } else {
          await apiRequest(`/journal/${id}/archive`, { method: "POST", body: JSON.stringify({ archived: !archived }) });
        }
        succeeded.push(id);
      } catch (failure) {
        failures.push(failure instanceof Error ? failure.message : "Action unavailable.");
      }
    }
    completed(succeeded);
    if (succeeded.length) {
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
      toast.success(
        `${succeeded.length} trade${succeeded.length === 1 ? "" : "s"} ${action === "delete" ? "deleted" : archived ? "restored" : "archived"}.`,
      );
    }
    if (failures.length) {
      setError(`${failures.length} trade${failures.length === 1 ? "" : "s"} could not be changed. ${failures[0]}`);
    } else setDeleting(false);
    setPending(null);
  }
  return (
    <div className="ml-auto flex shrink-0 flex-col gap-2">
      <FieldSet className="flex-row items-center justify-end gap-1" aria-label="Selected trade actions">
        <span className="mr-2 text-muted-foreground text-xs tabular-nums" aria-live="polite">
          {ids.length} selected
        </span>
        {[
          { label: "Ask AI about selected trades", Icon: Sparkles, action: ask, busy: false },
          {
            label: archived ? "Restore selected trades" : "Archive selected trades · finished trades only",
            Icon: archived ? ArchiveRestore : Archive,
            action: () => void run("archive"),
            busy: pending === "archive",
          },
          {
            label: "Delete selected trades",
            Icon: Trash2,
            action: () => {
              setError(null);
              setDeleting(true);
            },
            busy: pending === "delete",
          },
        ].map(({ label, Icon, action, busy }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label={label} disabled={!!pending} onClick={action}>
                {busy ? <Loader2 className="animate-spin" /> : <Icon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </FieldSet>
      {error && !deleting ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!pending) setDeleting(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {ids.length} selected trade{ids.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected trades, their exits and timelines from your journal and analytics.
              Alert rules remain independent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pending}>Keep trades</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!pending}
              onClick={(event) => {
                event.preventDefault();
                void run("delete");
              }}
            >
              {pending === "delete" ? "Deleting…" : "Delete trades"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
