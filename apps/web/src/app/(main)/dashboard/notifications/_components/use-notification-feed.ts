"use client";
import { useEffect } from "react";

import { useApiResource } from "@/hooks/use-api-resource";

import type { PagedResult } from "../../_components/collection-pagination";
import { useNotifications } from "./notification-provider";
import type { NotificationRecord } from "./notification-types";
export function useNotificationFeed(query: string, enabled = true) {
  const { revision } = useNotifications();
  const resource = useApiResource<PagedResult<NotificationRecord>>(enabled ? `/notifications?${query}` : null, {
    keepDataOnReload: true,
  });
  useEffect(() => {
    if (enabled && revision > 0) resource.reload();
  }, [enabled, revision, resource.reload]);
  return resource;
}
