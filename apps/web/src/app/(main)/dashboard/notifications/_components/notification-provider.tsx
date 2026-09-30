"use client";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import type { NotificationSummary } from "./notification-types";

interface NotificationContextValue {
  summary: NotificationSummary | null;
  error: string | null;
  loading: boolean;
  revision: number;
  pending: boolean;
  refresh: () => Promise<void>;
  mutate: (path: string, body?: { read?: boolean; archived?: boolean }, method?: "PATCH" | "POST") => Promise<boolean>;
}
const NotificationContext = createContext<NotificationContextValue | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const pendingRequests = useRef(new Set<string>());
  const lastRefresh = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    lastRefresh.current = Date.now();
    try {
      const result = await apiRequest<ApiEnvelope<NotificationSummary>>("/notifications/summary", {
        signal: request.signal,
      });
      if (!request.signal.aborted) {
        setSummary(result.data);
        setError(null);
        setRevision((value) => value + 1);
      }
    } catch (failure) {
      if (!request.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Could not load notifications.");
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      if (!document.hidden && Date.now() - lastRefresh.current > 10000) void refresh();
    };
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine) void refresh();
    }, 60000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("marketpilot-notifications");
      channel.current.onmessage = () => {
        if (!document.hidden) void refresh();
      };
    }
    return () => {
      clearInterval(timer);
      controller.current?.abort();
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);
  const mutate = useCallback(
    async (path: string, body?: { read?: boolean; archived?: boolean }, method: "PATCH" | "POST" = "PATCH") => {
      if (pendingRequests.current.size) return false;
      pendingRequests.current.add(path);
      setPending(true);
      try {
        await apiRequest(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
        await refresh();
        channel.current?.postMessage("changed");
        return true;
      } catch (failure) {
        toast.error(failure instanceof Error ? failure.message : "Could not update this notification.");
        return false;
      } finally {
        pendingRequests.current.delete(path);
        setPending(false);
      }
    },
    [refresh],
  );
  return (
    <NotificationContext value={{ summary, error, loading, revision, pending, refresh, mutate }}>
      {children}
    </NotificationContext>
  );
}
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("Notification components require NotificationProvider.");
  return context;
}
