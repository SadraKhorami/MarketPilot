"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LocalStatus {
  checkedAt: string | null;
  services: Array<{ id: string; label: string; status: "ready" | "attention" | "not_configured"; detail: string }>;
}

export function LocalServiceStatus() {
  const [data, setData] = useState<LocalStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      try {
        const response = await fetch("/api/dev-status", { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw new Error("Status unavailable");
        const result: LocalStatus = await response.json();
        if (!abort.signal.aborted) {
          setData(result);
          setUnavailable(false);
        }
      } catch {
        if (!abort.signal.aborted) setUnavailable(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    document.addEventListener("visibilitychange", load);
    return () => {
      abort.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  const age = data?.checkedAt ? now - new Date(data.checkedAt).getTime() : Infinity;
  const stale = !Number.isFinite(age) || age > 45000;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4" />
          Local services
        </CardTitle>
        <CardDescription>
          {unavailable
            ? "Status could not be loaded. Run pnpm dev:status in your terminal."
            : !data
              ? "Loading local status…"
              : !data.checkedAt
                ? "Run pnpm dev:full to start services and publish their status here."
                : stale
                  ? "This snapshot is out of date. Keep dev:full running or run pnpm dev:status."
                  : `Checked ${new Date(data.checkedAt).toLocaleTimeString()} · updates automatically`}
        </CardDescription>
      </CardHeader>
      {data && data.services.length > 0 && (
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.services.map((service) => (
            <div key={service.id} className="flex min-w-0 flex-col gap-1.5 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{service.label}</span>
                <Badge
                  variant={
                    stale || unavailable ? "outline" : service.status === "attention" ? "destructive" : "secondary"
                  }
                >
                  {stale || unavailable
                    ? "Not current"
                    : service.status === "ready"
                      ? "Ready"
                      : service.status === "attention"
                        ? "Check"
                        : "Not configured"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">{service.detail}</p>
            </div>
          ))}
        </CardContent>
      )}
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/admin/system">
            Detailed system status
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
