"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSessionUser } from "./auth-gate";

// Non-sensitive display preferences are isolated by account in this browser.
export function useAccountPreference<T>(name: string, defaults: T, validate: (value: unknown) => value is T) {
  const user = useSessionUser();
  const key = user ? `marketpilot:${user.id}:${name}:v1` : null;
  const [stored, setStored] = useState<{ key: string; value: T } | null>(null);
  useEffect(() => {
    if (!key) return;
    const read = () => {
      let value = defaults;
      try {
        const raw = window.localStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (validate(parsed)) value = parsed;
      } catch {
        // Defaults remain usable when browser storage is unavailable.
      }
      setStored({ key, value });
    };
    const sync = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== key) return;
      read();
    };
    read();
    window.addEventListener("storage", sync);
    window.addEventListener(`preference:${key}`, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(`preference:${key}`, sync);
    };
  }, [key, defaults, validate]);
  const value = stored?.key === key ? stored.value : defaults;
  const update = useCallback(
    (next: T) => {
      if (!key || !validate(next)) return;
      setStored({ key, value: next });
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(`preference:${key}`));
      } catch {
        toast.error("Your changes work now, but this browser could not save them for your next visit.");
      }
    },
    [key, validate],
  );
  return { value, update, ready: !!key && stored?.key === key };
}
