"use client";
import { useEffect, useRef, useState } from "react";

import type { ResearchResult, StreamEvent, TradeContext } from "@marketpilot/ai/contracts";

import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { streamResearch, toolLabels } from "./research-stream";

export interface ResearchTurn {
  archived?: boolean;
  requestId: string;
  input: string;
  tradeContext?: TradeContext;
  result: ResearchResult | null;
  status: string;
  error?: string;
  errorCode?: string;
}
function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Research was interrupted.";
}
function researchFailure(code: string | undefined, fallback: string) {
  switch (code) {
    case "AI_MISSING_CITATION":
      return "AI returned an analysis without citing the retrieved sources. The answer could not be verified; retry the question. This is not a rejection of the trade conditions.";
    case "AI_INVALID_CITATION":
      return "AI cited a source that was not retrieved for this request. The answer could not be verified; retry the question.";
    case "AI_EMPTY_OR_INVALID_ANSWER":
      return "AI returned an incomplete or incorrectly formatted answer. Retry the question.";
    default:
      return fallback;
  }
}
function historyTurn(turn: ResearchTurn): ResearchTurn {
  let error: string | undefined;
  if (turn.status === "running")
    error = "This request is still running or was interrupted. Recover its result before retrying.";
  else if (turn.status !== "completed")
    error = researchFailure(turn.errorCode, "This research request did not complete. You can retry.");
  return { ...turn, error };
}
export function useResearch() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ResearchTurn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [activity, setActivity] = useState<Array<Extract<StreamEvent, { type: "tool" }>>>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef<boolean>(true);
  const active = useRef<boolean>(false);
  useEffect(() => {
    mounted.current = true;
    const historyAbort = new AbortController();
    historyRequest.current = historyAbort;
    const requested = new URLSearchParams(window.location.search).get("conversation");
    const stored = requested ?? sessionStorage.getItem("marketpilot:ai:conversation");
    const id =
      stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)
        ? stored
        : crypto.randomUUID();
    sessionStorage.setItem("marketpilot:ai:conversation", id);
    setConversationId(id);
    apiRequest<ApiEnvelope<ResearchTurn[]>>(`/ai/history?conversationId=${id}`, { signal: historyAbort.signal })
      .then((response) => {
        if (mounted.current && !historyAbort.signal.aborted) setTurns(response.data.map(historyTurn));
      })
      .catch((error: Error) => {
        if (mounted.current && !historyAbort.signal.aborted) setHistoryError(error.message);
      })
      .finally(() => {
        if (!historyAbort.signal.aborted) setHydrated(true);
      });
    return () => {
      mounted.current = false;
      historyAbort.abort();
      historyRequest.current?.abort();
      abort.current?.abort();
    };
  }, []);
  function update(id: string, change: Partial<ResearchTurn>) {
    if (mounted.current)
      setTurns((current) => current.map((turn) => (turn.requestId === id ? { ...turn, ...change } : turn)));
  }
  async function send(
    input: string,
    watchlistId?: string,
    requestId = crypto.randomUUID(),
    tradeContext?: TradeContext,
  ) {
    if (!conversationId || active.current || !input.trim()) return;
    active.current = true;
    setRunning(true);
    setProgress("Starting research…");
    setActivity([]);
    const controller = new AbortController();
    abort.current = controller;
    setTurns((current) =>
      current.some((turn) => turn.requestId === requestId)
        ? current.map((turn) =>
            turn.requestId === requestId
              ? { ...turn, error: undefined, errorCode: undefined, status: "running" }
              : turn,
          )
        : [...current, { requestId, input, tradeContext, result: null, status: "running" }],
    );
    try {
      await streamResearch(
        {
          requestId,
          conversationId,
          input,
          ...(watchlistId ? { watchlistId } : {}),
          ...(tradeContext ? { tradeContext } : {}),
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]),
        (event) => {
          if (!mounted.current) return;
          if (event.type === "progress") setProgress(event.message);
          if (event.type === "tool") {
            setActivity((current) => [...current, event]);
            const detail =
              event.state === "running"
                ? "in progress…"
                : { ok: "received", partial: "has incomplete data", unavailable: "is unavailable" }[
                    event.status ?? "unavailable"
                  ];
            setProgress(
              event.state === "complete" && event.reason
                ? event.reason
                : event.outcome === "no_setup"
                  ? "No valid entry setup under the current conditions."
                  : event.outcome === "ready"
                    ? "Conditional entry plan ready."
                    : `${toolLabels[event.tool]} ${detail}`,
            );
          }
          if (event.type === "result")
            update(requestId, { result: event.result, status: "completed", error: undefined });
          if (event.type === "error")
            update(requestId, {
              status: "failed",
              error: researchFailure(event.code, event.message),
              errorCode: event.code,
            });
        },
      );
    } catch (error) {
      update(requestId, {
        status: controller.signal.aborted ? "cancelled" : "interrupted",
        error: controller.signal.aborted ? "Research cancelled." : failureMessage(error),
      });
    } finally {
      active.current = false;
      abort.current = null;
      if (mounted.current) {
        setRunning(false);
        setProgress("");
      }
    }
  }
  async function recover() {
    if (!conversationId || active.current) return;
    setHistoryError(null);
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    try {
      const response = await apiRequest<ApiEnvelope<ResearchTurn[]>>(`/ai/history?conversationId=${conversationId}`, {
        signal: controller.signal,
      });
      if (!mounted.current || controller.signal.aborted) return;
      setTurns((current) =>
        (current.length ? current : response.data).map((turn) => {
          const saved = response.data.find((item) => item.requestId === turn.requestId);
          return saved ? historyTurn(saved) : turn;
        }),
      );
    } catch (error) {
      if (mounted.current && !controller.signal.aborted)
        setHistoryError(error instanceof Error ? error.message : "Conversation history could not be loaded.");
    }
  }
  async function openConversation(id: string) {
    if (active.current) return;
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setConversationId(id);
    sessionStorage.setItem("marketpilot:ai:conversation", id);
    const url = new URL(window.location.href);
    url.searchParams.set("conversation", id);
    window.history.replaceState(null, "", url);
    setTurns([]);
    setActivity([]);
    setHistoryError(null);
    setHydrated(false);
    try {
      const response = await apiRequest<ApiEnvelope<ResearchTurn[]>>(`/ai/history?conversationId=${id}`, {
        signal: controller.signal,
      });
      if (mounted.current && !controller.signal.aborted) setTurns(response.data.map(historyTurn));
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setHistoryError(failureMessage(error));
    } finally {
      if (mounted.current && !controller.signal.aborted) setHydrated(true);
    }
  }
  function newConversation() {
    if (active.current) return;
    historyRequest.current?.abort();
    setHydrated(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("conversation");
    window.history.replaceState(null, "", url);
    const id = crypto.randomUUID();
    sessionStorage.setItem("marketpilot:ai:conversation", id);
    setConversationId(id);
    setTurns([]);
    setActivity([]);
    setHistoryError(null);
  }
  function changeResult(result: ResearchResult) {
    setTurns((current) => current.map((turn) => (turn.result?.runId === result.runId ? { ...turn, result } : turn)));
  }
  return {
    conversationId,
    openConversation,
    turns,
    archived: turns.some((turn) => turn.archived),
    running,
    progress,
    activity,
    historyError,
    ready: !!conversationId && hydrated,
    send,
    recover,
    newConversation,
    changeResult,
    cancel: () => abort.current?.abort(),
  };
}
