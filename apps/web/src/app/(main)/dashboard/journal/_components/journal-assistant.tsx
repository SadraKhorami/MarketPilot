"use client";
import { useRef, useState } from "react";
import { ArrowUp, Paperclip, FileSpreadsheet } from "lucide-react";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
} from "@/components/ui/attachment";
import { JournalImport } from "./journal-import";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";
import { ResourceState } from "../../_components/resource-state";
interface AssistantResult {
  answer: string;
  action: string;
  ids: string[];
  applied: boolean;
  scopeCount: number;
  trades: Array<{ id: string; symbol: string; status: string }>;
}
interface AssistantTurn {
  id: string;
  input: string;
  status: string;
  result: AssistantResult | null;
}
export function JournalAssistant({
  close,
  query,
  selected,
  changed,
}: {
  close: () => void;
  query: string;
  selected: string[];
  changed: () => void;
}) {
  const history = useApiResource<AssistantTurn[]>("/journal/assistant/history", { keepDataOnReload: true });
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(message: string) {
    if (!message.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/journal/assistant?${query}`, {
        method: "POST",
        body: JSON.stringify({ message, ...(selected.length ? { ids: selected } : {}) }),
      });
      setInput("");
      history.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Assistant unavailable.");
    } finally {
      setPending(false);
    }
  }
  async function confirm(id: string) {
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/journal/assistant/${id}/confirm`, { method: "POST", body: JSON.stringify({ confirm: true }) });
      changed();
      history.reload();
      window.dispatchEvent(new Event("marketpilot:journal-changed"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Action could not be applied.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Journal assistant</SheetTitle>
          <SheetDescription>
            {selected.length ? `${selected.length} selected trades` : "Current filters · latest 50 trades"}. Changes
            require your confirmation. History is retained for seven days.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              "Review my trading patterns and recurring mistakes",
              "Find trades with missing execution data",
              "Propose archiving inactive trades",
            ].map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                className="h-auto whitespace-normal py-1.5"
                disabled={pending || !!file}
                onClick={() => void send(question)}
              >
                {question}
              </Button>
            ))}
          </div>
          <ResourceState
            loading={history.loading}
            error={history.error}
            title="Assistant history unavailable"
            retry={history.reload}
          />
          <MessageScrollerProvider autoScroll>
            <div className="min-h-0 flex-1">
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent className="gap-5">
                    {(history.data ?? []).map((turn) => (
                      <MessageScrollerItem key={turn.id} messageId={turn.id}>
                        <div className="flex flex-col gap-3">
                          <Message align="end">
                            <MessageContent>
                              <MessageHeader>You</MessageHeader>
                              <Bubble variant="secondary">
                                <BubbleContent>{turn.input}</BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                          <Message>
                            <MessageContent>
                              <MessageHeader>Journal assistant</MessageHeader>
                              {turn.result ? (
                                <div className="flex flex-col gap-3">
                                  <p className="whitespace-pre-wrap text-sm" dir="auto">
                                    {turn.result.answer}
                                  </p>
                                  {turn.result.ids.length && turn.result.action !== "none" ? (
                                    <div className="flex flex-col gap-2 border-l-2 pl-3">
                                      <Badge variant="outline" className="self-start">
                                        {turn.result.applied
                                          ? "Applied"
                                          : `${turn.result.action} · ${turn.result.ids.length} trades`}
                                      </Badge>
                                      <ul className="flex flex-col gap-1 text-xs">
                                        {turn.result.trades.map((trade) => (
                                          <li key={trade.id}>
                                            {trade.symbol} · {trade.status} · {trade.id.slice(0, 8)}
                                          </li>
                                        ))}
                                      </ul>
                                      {!turn.result.applied ? (
                                        <Button
                                          size="sm"
                                          className="self-start"
                                          disabled={pending}
                                          onClick={() => void confirm(turn.id)}
                                        >
                                          Confirm {turn.result.action}
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <span className="text-muted-foreground text-xs">
                                    Scope: {turn.result.scopeCount} trades
                                  </span>
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  {turn.status === "running"
                                    ? "Working…"
                                    : "This request did not complete. No trades were changed."}
                                </p>
                              )}
                            </MessageContent>
                          </Message>
                        </div>
                      </MessageScrollerItem>
                    ))}
                    {file ? (
                      <MessageScrollerItem messageId={`attachment-${file.name}`}>
                        <Message align="end">
                          <MessageContent>
                            <MessageHeader>You</MessageHeader>
                            <Attachment>
                              <AttachmentMedia>
                                <FileSpreadsheet />
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle>{file.name}</AttachmentTitle>
                                <AttachmentDescription>
                                  {(file.size / 1024).toFixed(0)} KB · review before importing
                                </AttachmentDescription>
                              </AttachmentContent>
                            </Attachment>
                          </MessageContent>
                        </Message>
                        <div className="mt-4">
                          <JournalImport
                            embedded
                            initialFile={file}
                            close={() => setFile(null)}
                            changed={(summary) => {
                              changed();
                              setImportNotice(
                                `${file.name} · ${summary?.added ?? 0} trades imported${summary?.skipped ? ` · ${summary.skipped} duplicates skipped` : ""}.`,
                              );
                            }}
                          />
                        </div>
                      </MessageScrollerItem>
                    ) : null}
                    {importNotice ? (
                      <MessageScrollerItem messageId="import-result">
                        <Message>
                          <MessageContent>
                            <MessageHeader>Journal assistant</MessageHeader>
                            <Bubble>
                              <BubbleContent>{importNotice}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </div>
          </MessageScrollerProvider>
          {pending ? (
            <p role="status" className="text-muted-foreground text-sm">
              Working with your journal…
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.json"
            className="sr-only"
            aria-label="Attach journal file"
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              if (chosen) {
                setFile(chosen);
                setImportNotice(null);
              }
              event.target.value = "";
            }}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                aria-label="Journal assistant question"
                placeholder="Ask about these trades or propose an action…"
                rows={2}
                maxLength={2000}
                value={input}
                disabled={pending}
                onChange={(e) => setInput(e.target.value)}
              />
              <InputGroupAddon align="block-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Attach Excel or JSON"
                  title="Attach Excel or JSON"
                  disabled={pending || !!file}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip />
                </Button>
                <span className="mr-auto text-muted-foreground text-xs">
                  Excel / JSON · {file ? "Review your attachment above" : "Your journal, your AI provider"}
                </span>
                <Button
                  type="submit"
                  size="icon-sm"
                  aria-label="Send journal question"
                  disabled={pending || !!file}
                  aria-disabled={!input.trim()}
                  onClick={(e) => {
                    if (!input.trim()) e.preventDefault();
                  }}
                >
                  <ArrowUp />
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
