"use client";
import { useEffect, useRef, useState } from "react";

import type { ResearchResult, StreamEvent } from "@marketpilot/ai/contracts";

import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { streamResearch, toolLabels } from "./research-stream";

export interface ResearchTurn {
  requestId: string;
  input: string;
  result: ResearchResult | null;
  status: string;
  error?: string;
  errorCode?: string;
}
function failureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Research was interrupted.";
}
function historyTurn(turn: ResearchTurn): ResearchTurn {
  let error: string | undefined;
  if (turn.status === "running")
    error = "This request is still running or was interrupted. Recover its result before retrying.";
  else if (turn.status !== "completed") error = "This research request did not complete. You can retry.";
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
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef<boolean>(true);
  const active = useRef<boolean>(false);
  useEffect(() => {
    mounted.current = true;
    const historyAbort = new AbortController();
    const stored = sessionStorage.getItem("marketpilot:ai:conversation");
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
      abort.current?.abort();
    };
  }, []);
  function update(id: string, change: Partial<ResearchTurn>) {
    if (mounted.current)
      setTurns((current) => current.map((turn) => (turn.requestId === id ? { ...turn, ...change } : turn)));
  }
  async function send(input: string, watchlistId?: string, requestId = crypto.randomUUID()) {
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
            turn.requestId === requestId ? { ...turn, error: undefined, status: "running" } : turn,
          )
        : [...current, { requestId, input, result: null, status: "running" }],
    );
    try {
      await streamResearch(
        { requestId, conversationId, input, ...(watchlistId ? { watchlistId } : {}) },
        AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]),
        (event) => {
          if (!mounted.current) return;
          if (event.type === "progress") setProgress(event.message);
          if (event.type === "tool") {
            setActivity((current) => [...current, event]);
            const detail =
              event.state === "running"
                ? "in progress…"
                : { ok: "received", partial: "has limited data", unavailable: "is unavailable" }[
                    event.status ?? "unavailable"
                  ];
            setProgress(`${toolLabels[event.tool]} ${detail}`);
          }
          if (event.type === "result")
            update(requestId, { result: event.result, status: "completed", error: undefined });
          if (event.type === "error")
            update(requestId, { status: "failed", error: event.message, errorCode: event.code });
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
    try {
      const response = await apiRequest<ApiEnvelope<ResearchTurn[]>>(`/ai/history?conversationId=${conversationId}`);
      setTurns((current) =>
        current.map((turn) => {
          const saved = response.data.find((item) => item.requestId === turn.requestId);
          return saved ? historyTurn(saved) : turn;
        }),
      );
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Conversation history could not be loaded.");
    }
  }
  function newConversation() {
    if (active.current) return;
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
    turns,
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
