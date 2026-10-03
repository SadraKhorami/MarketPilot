"use client";
import { useState } from "react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SystemSection } from "./system-section";
import { useSystemRefresh } from "./use-system-refresh";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api/client";

import { ResourceState } from "../../_components/resource-state";
import { AdminBotDeliveries } from "./admin-bot-deliveries";

interface BotOverview {
  checkedAt: string;
  workers: { commands: number; alerts: number } | null;
  providers: Array<{
    provider: string;
    configured: boolean;
    missing: string[];
    invalid: string[];
    runtime: {
      inboundAt: string | null;
      checkedAt: string | null;
      successfulAt: string | null;
      failureCode: string | null;
    } | null;
  }>;
}
export function AdminBots() {
  const resource = useApiResource<BotOverview>("/admin/bots", { keepDataOnReload: true });
  const [busy, setBusy] = useState<string | null>(null);
  useSystemRefresh(resource.reload);
  async function check(provider: string) {
    setBusy(provider);
    try {
      await apiRequest(`/admin/bots/${provider.toLowerCase()}/check`, { method: "POST" });
      resource.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check connectivity.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <SystemSection
      title="Bots"
      description="Provider configuration, runtime and deliveries"
      icon={Bot}
      defaultOpen={false}
      summary={
        resource.data && !resource.error ? (
          <Badge variant="outline">
            {resource.data.providers.filter((provider) => provider.configured).length}/{resource.data.providers.length}{" "}
            configured
          </Badge>
        ) : undefined
      }
    >
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && !resource.error ? (
          <>
            <p className="text-muted-foreground text-xs">
              Command workers: {resource.data.workers?.commands ?? "Unavailable"} · Alert workers:{" "}
              {resource.data.workers?.alerts ?? "Unavailable"} · Heartbeats within 45 seconds
            </p>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Configuration</TableHead>
                  <TableHead>Last successful response</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resource.data.providers.map((provider) => (
                  <TableRow key={provider.provider}>
                    <TableCell className="font-medium">{provider.provider}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{provider.configured ? "Configured" : "Setup required"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {provider.runtime?.successfulAt
                        ? new Date(provider.runtime.successfulAt).toLocaleString()
                        : "Not observed"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!provider.configured || busy !== null}
                        onClick={() => void check(provider.provider)}
                      >
                        {busy === provider.provider ? "Checking…" : "Check connectivity"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {resource.data.providers.map((provider) => (
              <details key={provider.provider} className="rounded-lg border px-3 py-2">
                <summary className="cursor-pointer text-sm">{provider.provider} runtime details</summary>
                <div className="mt-3 flex flex-col gap-2 text-xs">
                  {!provider.configured ? (
                    <p className="text-muted-foreground">
                      Set server configuration: {[...provider.missing, ...provider.invalid].join(", ")}. Register the
                      webhook using the documented bot setup command.
                    </p>
                  ) : null}
                  <p>
                    Last authenticated event:{" "}
                    {provider.runtime?.inboundAt
                      ? new Date(provider.runtime.inboundAt).toLocaleString()
                      : "Not observed"}
                  </p>
                  <p>
                    Last provider check / send:{" "}
                    {provider.runtime?.checkedAt
                      ? new Date(provider.runtime.checkedAt).toLocaleString()
                      : "Not observed"}
                  </p>
                  {provider.runtime?.failureCode ? (
                    <p className="break-words text-destructive">{provider.runtime.failureCode.replaceAll("_", " ")}</p>
                  ) : null}
                </div>
              </details>
            ))}
          </>
        ) : null}
        <AdminBotDeliveries />
      </div>
    </SystemSection>
  );
}
