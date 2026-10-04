"use client";
import type { ReactNode } from "react";

import { permitsTradeSetup, type TradeContext } from "@marketpilot/ai/contracts";

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

import { ResearchResponse } from "./research-response";
import type { useResearch } from "./use-research";
export function ResearchConversation({
  research,
  disabled,
  watchlistId,
  onTradeRequest,
  children,
}: {
  research: ReturnType<typeof useResearch>;
  disabled: boolean;
  watchlistId: string;
  onTradeRequest: (input: string, edit?: { context?: TradeContext; revisionId?: string }) => void;
  children?: ReactNode;
}) {
  return (
    <MessageScrollerProvider autoScroll={!children}>
      <div className="min-h-0 min-w-0 flex-1">
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 py-2">
              {!children &&
                research.turns.map((turn) => (
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
                            <ResearchResponse
                              result={turn.result}
                              change={research.changeResult}
                              edit={() =>
                                onTradeRequest(turn.input, {
                                  context: turn.tradeContext,
                                  revisionId: turn.result?.journalEntryId ?? undefined,
                                })
                              }
                              persian={/[\u0600-\u06ff]/u.test(turn.input)}
                            />
                          </MessageContent>
                        </Message>
                      ) : null}
                      {turn.error ? (
                        <Alert
                          variant="destructive"
                          className="@2xl/main:grid-cols-[minmax(0,1fr)_auto] @2xl/main:items-center gap-3"
                        >
                          <div className="min-w-0">
                            <AlertTitle>
                              {turn.errorCode === "AI_MISSING_CITATION" || turn.errorCode === "AI_INVALID_CITATION"
                                ? "AI response could not be verified"
                                : "Research did not complete"}
                            </AlertTitle>
                            <AlertDescription className="mt-1 [overflow-wrap:anywhere]">{turn.error}</AlertDescription>
                          </div>
                          <div className="flex flex-wrap items-center @2xl/main:justify-end gap-2">
                            {turn.status === "interrupted" || turn.status === "running" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={research.running}
                                onClick={() => void research.recover()}
                              >
                                Recover result
                              </Button>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={disabled || turn.status === "running"}
                              onClick={() => {
                                if (!turn.tradeContext && permitsTradeSetup(turn.input)) onTradeRequest(turn.input);
                                else
                                  void research.send(
                                    turn.input,
                                    watchlistId === "default" ? undefined : watchlistId,
                                    undefined,
                                    turn.tradeContext,
                                  );
                              }}
                            >
                              Retry question
                            </Button>
                          </div>
                        </Alert>
                      ) : null}
                    </div>
                  </MessageScrollerItem>
                ))}
              {children ? (
                <MessageScrollerItem messageId="trade-context">
                  <Message>
                    <MessageContent>
                      <MessageHeader>MarketPilot</MessageHeader>
                      {children}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          {!children ? <MessageScrollerButton /> : null}
        </MessageScroller>
      </div>
    </MessageScrollerProvider>
  );
}
