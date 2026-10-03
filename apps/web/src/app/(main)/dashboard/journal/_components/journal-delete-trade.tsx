"use client";
import { useState } from "react";
import type { JournalRecord } from "@marketpilot/ai/contracts";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api/client";
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
export function JournalDeleteTrade({
  entry,
  close,
  changed,
}: {
  entry: JournalRecord;
  close: () => void;
  changed: () => void;
}) {
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  async function remove() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await apiRequest(`/journal/${entry.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true, updatedAt: entry.updatedAt }),
      });
      close();
      changed();
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
      toast.success("Trade deleted.");
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : "Deletion unavailable.");
    } finally {
      setDeletePending(false);
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !deletePending) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entry.symbol} trade?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the trade, its executions and timeline from your journal and performance reports. This cannot
            be undone. Associated alert rules remain independent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError ? (
          <p role="alert" className="text-destructive text-sm">
            {deleteError}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePending}>Keep trade</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deletePending}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            {deletePending ? "Deleting…" : "Delete trade"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
