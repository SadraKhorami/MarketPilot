"use client";
import { useEffect, useState } from "react";

import { History, MessageSquare, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useApiResource } from "@/hooks/use-api-resource";

import { CollectionPagination, type PagedResult } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";

interface Conversation {
  conversationId: string;
  title: string;
  updatedAt: string;
  turnCount: number;
}
export function ResearchHistory({
  currentId,
  disabled,
  onSelect,
}: {
  currentId: string | null;
  disabled: boolean;
  onSelect: (id: string) => Promise<void>;
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
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="pr-12">
          <SheetTitle>Research history</SheetTitle>
          <SheetDescription>
            Continue your private conversations from the dashboard or bots. Research is retained for seven days; each
            conversation shows its latest twenty turns.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <ConversationList
            currentId={currentId}
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
function ConversationList({ currentId, onSelect }: { currentId: string | null; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const resource = useApiResource<PagedResult<Conversation>>(
    `/ai/conversations?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(query)}`,
  );
  useEffect(() => {
    if (resource.data && page > Math.max(1, resource.data.totalPages)) setPage(Math.max(1, resource.data.totalPages));
  }, [resource.data, page]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="px-4">
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search conversations"
            placeholder="Search your questions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && !resource.error && resource.data.items.length > 0 ? (
          <div className="space-y-2">
            {resource.data.items.map((item) => (
              <Button
                key={item.conversationId}
                variant={currentId === item.conversationId ? "secondary" : "ghost"}
                className="h-auto w-full min-w-0 items-start justify-start gap-3 whitespace-normal p-3 text-left"
                onClick={() => onSelect(item.conversationId)}
              >
                <MessageSquare className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words font-medium">{item.title}</span>
                  <span className="mt-1 block text-muted-foreground text-xs">
                    {new Date(item.updatedAt).toLocaleString()} · {item.turnCount} requests
                  </span>
                  {currentId === item.conversationId ? (
                    <Badge variant="outline" className="mt-2">
                      Current conversation
                    </Badge>
                  ) : null}
                </span>
              </Button>
            ))}
          </div>
        ) : null}
        {resource.data && !resource.error && resource.data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{query ? "No matching conversations" : "No saved conversations yet"}</EmptyTitle>
              <EmptyDescription>
                {query
                  ? "Try another word from your research questions."
                  : "Your conversations appear here after you send a research question."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
      {resource.data && !resource.error && resource.data.total > 0 ? (
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
    </div>
  );
}
