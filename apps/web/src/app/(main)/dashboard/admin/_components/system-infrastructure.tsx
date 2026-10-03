import { Database, Newspaper, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SystemState } from "./admin-types";
import { SystemSection } from "./system-section";

export function SystemInfrastructure({ data }: { data: SystemState }) {
  const services = [
    { name: "PostgreSQL", icon: Database, check: data.database, detail: "Application data and durable alert events" },
    { name: "Redis", icon: Server, check: data.redis, detail: "Queues, schedules and cached observations" },
  ];
  const healthy = services.filter((service) => service.check.status === "healthy").length;
  return (
    <SystemSection
      title="Infrastructure"
      description="Database, cache and stored content"
      icon={Server}
      summary={
        <Badge variant={healthy === services.length ? "secondary" : "destructive"}>
          {healthy}/{services.length} healthy
        </Badge>
      }
    >
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="pl-6">Service</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Response</TableHead>
            <TableHead className="pr-6">Purpose</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map(({ name, icon: Icon, check, detail }) => (
            <TableRow key={name}>
              <TableCell className="pl-6">
                <span className="flex items-center gap-3 font-medium">
                  <Icon className="size-4 text-muted-foreground" />
                  {name}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={check.status === "healthy" ? "secondary" : "destructive"}>
                  {check.status === "healthy" ? "Healthy" : "Unavailable"}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {check.latencyMs === null ? "—" : `${check.latencyMs} ms`}
              </TableCell>
              <TableCell className="pr-6 text-muted-foreground text-xs">{detail}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="pl-6">
              <span className="flex items-center gap-3 font-medium">
                <Newspaper className="size-4 text-muted-foreground" />
                News library
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{data.articles === null ? "Unavailable" : "Stored content"}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {data.articles === null ? "—" : `${data.articles.toLocaleString()} articles`}
            </TableCell>
            <TableCell className="pr-6 text-muted-foreground text-xs">
              Sourced content for search and AI research
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </SystemSection>
  );
}
