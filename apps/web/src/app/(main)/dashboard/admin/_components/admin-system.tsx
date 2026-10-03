"use client";

import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { ResourceState } from "../../_components/resource-state";
import { AdminAiMetrics } from "./admin-ai-metrics";
import { AdminBots } from "./admin-bots";
import { AdminJobs } from "./admin-jobs";
import type { SystemState } from "./admin-types";
import { SystemSection } from "./system-section";
import { useSystemRefresh } from "./use-system-refresh";

export function AdminSystem() {
  const resource = useApiResource<SystemState>("/admin/system", { keepDataOnReload: true });
  const data = resource.data;
  useSystemRefresh(resource.reload);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AdminJobs system={resource} />
      <AdminBots />
      <AdminAiMetrics />
      <SystemSection
        title="Integrations"
        description="Server configuration · external availability is checked separately"
        icon={Layers}
        defaultOpen={false}
        summary={
          data && !resource.error ? <Badge variant="outline">{data.integrations.length} integrations</Badge> : undefined
        }
      >
        <ResourceState {...resource} retry={resource.reload} />
        {data && !resource.error ? (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-4">Integration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.integrations.map((integration) => (
                <TableRow key={integration.name}>
                  <TableCell className="pl-4 font-medium">{integration.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{integration.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-lg whitespace-normal pr-4 text-muted-foreground text-xs">
                    {integration.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </SystemSection>
    </div>
  );
}
