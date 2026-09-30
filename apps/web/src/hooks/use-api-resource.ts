"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { type ApiEnvelope, ApiError, apiRequest } from "@/lib/api/client";

export function useApiResource<T>(
  path: string | null,
  { keepDataOnReload = false }: { keepDataOnReload?: boolean } = {},
) {
  const lastResolvedPath = useRef<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string>();
  const [status, setStatus] = useState<number | null>(null);
  const reload = useCallback(() => setRequestId(crypto.randomUUID()), []);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      setError(null);
      setStatus(null);
      lastResolvedPath.current = null;
      return;
    }
    const controller = new AbortController();
    setLoading(!keepDataOnReload || lastResolvedPath.current !== path);
    setError(null);
    setStatus(null);
    apiRequest<ApiEnvelope<T>>(path, {
      signal: controller.signal,
      headers: requestId ? { "X-Request-Id": requestId } : undefined,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          lastResolvedPath.current = path;
          setData(result.data);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setStatus(failure instanceof ApiError ? failure.status : 0);
          setError(failure instanceof Error ? failure.message : "Could not load this view.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, requestId, keepDataOnReload]);
  return { data, loading, error, status, reload };
}
