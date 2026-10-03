"use client";
import { useEffect, useState } from "react";
import type { ConversationRecord } from "@marketpilot/ai/contracts";
import { Archive, ArchiveRestore, Download, History, MessageSquare, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiResource } from "@/hooks/use-api-resource";
import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import { exportConversations, manageConversations } from "./conversation-actions";
export function ResearchHistory({
  currentId,
  disabled,
  onSelect,
  onChanged,
}: {
  currentId: string | null;
  disabled: boolean;
  onSelect: (id: string) => Promise<void>;
  onChanged: (ids?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <History data-icon="inline-start" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="pr-12">
          <SheetTitle>Research history</SheetTitle>
          <SheetDescription>
            Continue, export or organize your conversations. Active and archived chats are retained for seven days; the
            chat shows its latest twenty turns.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <ConversationList
            currentId={currentId}
            onChanged={onChanged}
            onSelect={(id) => {
              setOpen(false);
              void onSelect(id);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
function HistoryAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
function ConversationList({
  currentId,
  onSelect,
  onChanged,
}: {
  currentId: string | null;
  onSelect: (id: string) => void;
  onChanged: (ids?: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
      setSelected([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const resource = useApiResource<PagedResult<ConversationRecord>>(
    `/ai/conversations?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(query)}&state=${state}`,
  );
  useEffect(() => {
    const changed = () => resource.reload();
    window.addEventListener("marketpilot:conversations-changed", changed);
    return () => window.removeEventListener("marketpilot:conversations-changed", changed);
  }, [resource.reload]);
  useEffect(() => {
    if (resource.data && page > Math.max(1, resource.data.totalPages)) setPage(Math.max(1, resource.data.totalPages));
  }, [resource.data, page]);
  async function action(kind: "archive" | "restore" | "delete" | "export", ids: string[]) {
    setPending(true);
    try {
      if (kind === "export") await exportConversations(ids[0]);
      else {
        await manageConversations(kind, ids);
        setSelected([]);
        setDeleting(null);
        if (kind !== "restore") onChanged(ids);
        else if (ids.includes(currentId ?? "")) onSelect(currentId!);
      }
      toast.success(
        kind === "delete"
          ? "Conversation content deleted."
          : kind === "archive"
            ? "Conversations archived."
            : kind === "restore"
              ? "Conversations restored."
              : "Export downloaded.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setPending(false);
    }
  }
  const items = resource.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.conversationId));
  function select(ids: string[], checked: boolean) {
    setSelected((current) =>
      checked ? [...new Set([...current, ...ids])].slice(0, 50) : current.filter((id) => !ids.includes(id)),
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-3 px-4">
        <Tabs
          value={state}
          onValueChange={(value) => {
            setState(value);
            setPage(1);
            setSelected([]);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search conversations"
            placeholder="Search your questions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
        {items.length ? (
          <div className="flex min-h-8 flex-wrap items-center gap-2">
            <Checkbox
              checked={
                allSelected
                  ? true
                  : items.some((item) => selected.includes(item.conversationId))
                    ? "indeterminate"
                    : false
              }
              disabled={pending}
              aria-label="Select conversations on this page"
              onCheckedChange={(checked) =>
                select(
                  items.map((item) => item.conversationId),
                  checked === true,
                )
              }
            />
            <span className="mr-auto text-muted-foreground text-xs">
              {selected.length ? `${selected.length} selected · up to 50` : "Select this page"}
            </span>
            {selected.length ? (
              <>
                <HistoryAction
                  label={state === "archived" ? "Restore selected chats" : "Archive selected chats"}
                  disabled={pending}
                  onClick={() => void action(state === "archived" ? "restore" : "archive", selected)}
                >
                  {state === "archived" ? <ArchiveRestore /> : <Archive />}
                </HistoryAction>
                <HistoryAction label="Delete selected chats" disabled={pending} onClick={() => setDeleting(selected)}>
                  <Trash2 />
                </HistoryAction>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <ResourceState {...resource} retry={resource.reload} />
        {!resource.error && items.length ? (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.conversationId}
                className="flex min-w-0 items-center gap-2 rounded-lg p-1 hover:bg-muted/50"
              >
                <Checkbox
                  aria-label={`Select ${item.title}`}
                  checked={selected.includes(item.conversationId)}
                  disabled={pending}
                  onCheckedChange={(checked) => select([item.conversationId], checked === true)}
                />
                <Button
                  variant={currentId === item.conversationId ? "secondary" : "ghost"}
                  disabled={pending}
                  className="h-auto min-w-0 flex-1 justify-start whitespace-normal p-2 text-left"
                  onClick={() => onSelect(item.conversationId)}
                >
                  <MessageSquare data-icon="inline-start" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words">{item.title}</span>
                    <span className="mt-1 block text-muted-foreground text-xs">
                      {new Date(item.updatedAt).toLocaleString()} · {item.turnCount} requests
                    </span>
                    {currentId === item.conversationId ? (
                      <Badge variant="outline" className="mt-1">
                        Current chat
                      </Badge>
                    ) : null}
                  </span>
                </Button>
                <div className="flex shrink-0 gap-0.5">
                  <HistoryAction
                    label="Export chat"
                    disabled={pending}
                    onClick={() => void action("export", [item.conversationId])}
                  >
                    <Download />
                  </HistoryAction>
                  <HistoryAction
                    label={item.archived ? "Restore chat" : "Archive chat"}
                    disabled={pending}
                    onClick={() => void action(item.archived ? "restore" : "archive", [item.conversationId])}
                  >
                    {item.archived ? <ArchiveRestore /> : <Archive />}
                  </HistoryAction>
                  <HistoryAction
                    label="Delete chat"
                    disabled={pending}
                    onClick={() => setDeleting([item.conversationId])}
                  >
                    <Trash2 />
                  </HistoryAction>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!resource.loading && !resource.error && !items.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {query
                  ? "No matching conversations"
                  : state === "archived"
                    ? "No archived conversations"
                    : "No saved conversations yet"}
              </EmptyTitle>
              <EmptyDescription>
                {query
                  ? "Try another word from your questions."
                  : state === "archived"
                    ? "Archive a chat to keep it separate from your active conversations."
                    : "Your chats appear here after you send a research question."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
      {resource.data && resource.data.total > 0 ? (
        <CollectionPagination
          page={page}
          pageSize={pageSize}
          total={resource.data.total}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      ) : null}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleting?.length === 1 ? "this conversation" : `${deleting?.length} conversations`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Questions and answers will be permanently erased. Saved journal plans and alerts remain. Export first if
              you need a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) void action("delete", deleting);
              }}
            >
              {pending ? "Deleting…" : "Delete chats"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
