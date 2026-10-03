"use client";
import { useState } from "react";
import { Archive, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { API_BASE, apiRequest } from "@/lib/api/client";
export async function exportConversations(conversationId?: string) {
  const response = await fetch(
    `${API_BASE}/ai/conversations/export${conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ""}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) throw new Error("Conversations could not be exported. Try again.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = conversationId ? `marketpilot-chat-${conversationId}.ndjson` : "marketpilot-research.ndjson";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function manageConversations(action: "archive" | "restore" | "delete", ids?: string[]) {
  await apiRequest("/ai/conversations/manage", {
    method: "POST",
    body: JSON.stringify({ action, scope: ids ? "selected" : "all", ...(ids ? { ids } : {}) }),
  });
  window.dispatchEvent(new Event("marketpilot:conversations-changed"));
}
export function ConversationActions({
  currentId,
  disabled,
  changed,
}: {
  currentId: string | null;
  disabled: boolean;
  changed: (ids?: string[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  async function act(action: "export-current" | "export-all" | "archive" | "delete") {
    setPending(true);
    try {
      if (action.startsWith("export"))
        await exportConversations(action === "export-current" ? (currentId ?? undefined) : undefined);
      else {
        await manageConversations(action === "archive" ? "archive" : "delete");
        changed();
      }
      toast.success(
        action.startsWith("export")
          ? "Export downloaded."
          : action === "archive"
            ? "Conversations archived."
            : "Conversation content deleted.",
      );
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Export</h3>
        <p className="text-muted-foreground text-sm">
          Download questions and answers as NDJSON, including archived conversations within the seven-day retention
          window.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={disabled || pending || !currentId}
            onClick={() => void act("export-current")}
          >
            <Download data-icon="inline-start" />
            Current chat
          </Button>
          <Button variant="outline" disabled={disabled || pending} onClick={() => void act("export-all")}>
            <Download data-icon="inline-start" />
            All chats
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Manage conversations</h3>
        <p className="text-muted-foreground text-sm">
          Archives stay available in History. Deleting chat content keeps saved journal plans, alerts and usage records.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={disabled || pending} onClick={() => setConfirm("archive")}>
            <Archive data-icon="inline-start" />
            Archive all chats
          </Button>
          <Button variant="destructive" disabled={disabled || pending} onClick={() => setConfirm("delete")}>
            <Trash2 data-icon="inline-start" />
            Delete all chats
          </Button>
        </div>
      </div>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? "Delete all conversation content?" : "Archive all conversations?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "Questions and answers will be permanently erased. Your saved journal plans and alerts remain. Export first if you need a copy."
                : "All chats move to Archived in History. You can restore them there. The seven-day retention period still applies."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                if (confirm) void act(confirm);
              }}
            >
              {pending ? "Working…" : confirm === "delete" ? "Delete all chats" : "Archive all chats"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
