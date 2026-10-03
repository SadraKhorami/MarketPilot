"use client";
import { useEffect, useEffectEvent } from "react";

export function useSystemRefresh(reload: () => void) {
  const refresh = useEffectEvent(reload);
  useEffect(() => {
    const manual = () => refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    window.addEventListener("marketpilot:system-refresh", manual);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("marketpilot:system-refresh", manual);
    };
  }, []);
}
