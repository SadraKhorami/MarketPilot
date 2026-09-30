"use client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

import { AlertProposal } from "./alert-proposal";
import { ResearchSources } from "./research-sources";
import { toolLabels } from "./research-stream";
import type { useResearch } from "./use-research";
export function ResearchConversation({
  research,
  disabled,
  watchlistId,
}: {
  research: ReturnType<typeof useResearch>;
  disabled: boolean;
  watchlistId: string;
}) {
  return (
    <MessageScrollerProvider autoScroll>
      <div className="min-h-0 min-w-0 flex-1">
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 py-2">
              {research.turns.map((turn) => (
                <MessageScrollerItem
                  key={turn.requestId}
                  messageId={turn.requestId}
                  scrollAnchor={turn.status === "running"}
                >
                  <div className="flex min-w-0 flex-col gap-4">
                    <Message align="end">
                      <MessageContent>
                        <MessageHeader>You</MessageHeader>
                        <Bubble variant="secondary">
                          <BubbleContent className="whitespace-pre-wrap">{turn.input}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                    {turn.result ? (
                      <Message>
                        <MessageContent>
                          <MessageHeader>MarketPilot · Interpretation</MessageHeader>
                          <Bubble variant="ghost">
                            <BubbleContent>
                              <div className="flex flex-col gap-3">
                                {turn.result.answer.interpretation.map((item, index) => (
                                  <div key={item.text} className="flex flex-col gap-1">
                                    <p className="font-medium text-sm">
                                      {["Summary", "Technical interpretation", "Context & limitations"][index] ??
                                        "Additional analysis"}
                                    </p>
                                    <p className="whitespace-pre-wrap">{item.text}</p>
                                    {item.sourceIds.length ? (
                                      <p className="mt-1 text-muted-foreground text-xs">
                                        Sources:{" "}
                                        {[
                                          ...new Set(
                                            item.sourceIds
                                              .map((id) => turn.result?.sources.find((s) => s.id === id)?.title)
                                              .filter(Boolean),
                                          ),
                                        ].join(" · ")}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </BubbleContent>
                          </Bubble>
                          <h3 className="font-medium text-sm">Retrieved evidence</h3>
                          <ResearchSources sources={turn.result.sources} />
                          {turn.result.proposals.map((proposal) => (
                            <AlertProposal
                              key={proposal.id}
                              proposal={proposal}
                              change={(updated) => {
                                if (turn.result)
                                  research.changeResult({
                                    ...turn.result,
                                    proposals: turn.result.proposals.map((p) => (p.id === updated.id ? updated : p)),
                                  });
                              }}
                            />
                          ))}
                          <details>
                            <summary className="cursor-pointer text-muted-foreground text-xs">
                              Research activity · {turn.result.tools.length} lookups
                            </summary>
                            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground text-xs">
                              {turn.result.tools.map((tool) => (
                                <li key={tool.id}>
                                  {toolLabels[tool.tool]} · {tool.status} · {tool.latencyMs} ms
                                </li>
                              ))}
                            </ul>
                          </details>
                        </MessageContent>
                      </Message>
                    ) : null}
                    {turn.error ? (
                      <Alert
                        variant="destructive"
                        className="@2xl/main:grid-cols-[minmax(0,1fr)_auto] @2xl/main:items-center gap-3"
                      >
                        <div className="min-w-0">
                          <AlertTitle>Research did not complete</AlertTitle>
                          <AlertDescription className="mt-1 [overflow-wrap:anywhere]">{turn.error}</AlertDescription>
                        </div>
                        <div className="flex flex-wrap items-center @2xl/main:justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={research.running} onClick={research.recover}>
                            Recover result
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={disabled || turn.status === "running"}
                            onClick={() =>
                              research.send(turn.input, watchlistId === "default" ? undefined : watchlistId)
                            }
                          >
                            Retry question
                          </Button>
                        </div>
                      </Alert>
                    ) : null}
                  </div>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </div>
    </MessageScrollerProvider>
  );
}
