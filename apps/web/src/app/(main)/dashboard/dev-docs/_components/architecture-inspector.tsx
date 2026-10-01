"use client";

import { ArrowUpRight, Focus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  type ArchitectureEnvironment,
  type ArchitectureService,
  getService,
  type ServiceId,
} from "./architecture-data";
import type { DiagramConnection } from "./architecture-diagram";

export function ArchitectureInspector({
  selectedService,
  availableServices,
  environment,
  connections,
  onSelect,
  onFocus,
}: {
  selectedService: ArchitectureService;
  availableServices: ArchitectureService[];
  environment: ArchitectureEnvironment;
  connections: DiagramConnection[];
  onSelect: (id: ServiceId) => void;
  onFocus?: () => void;
}) {
  const selectedId = selectedService.id;
  const SelectedIcon = selectedService.icon;
  const relatedConnections = connections.filter(
    (connection) => connection.source === selectedId || connection.target === selectedId,
  );
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <SelectedIcon className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{selectedService.title}</CardTitle>
            <CardDescription>{selectedService.subtitle}</CardDescription>
          </div>
        </div>
        <Select
          value={selectedId}
          onValueChange={(value) => {
            const service = availableServices.find((item) => item.id === value);
            if (service) onSelect(service.id);
          }}
        >
          <SelectTrigger className="w-full sm:w-60" aria-label="Inspect an architecture service">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableServices.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {getService(service, environment).title}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6 lg:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-3">
          <h3 className="font-medium text-sm">Responsibilities</h3>
          <ul className="flex list-disc flex-col gap-2 pl-4 text-muted-foreground text-xs leading-relaxed">
            {selectedService.responsibilities.map((responsibility) => (
              <li key={responsibility}>{responsibility}</li>
            ))}
          </ul>
        </section>
        <section className="flex min-w-0 flex-col gap-3">
          <h3 className="font-medium text-sm">Connected services</h3>
          <div className="flex flex-col gap-2">
            {relatedConnections.map((connection) => {
              const incoming = connection.target === selectedId;
              const peer = availableServices.find(
                (service) => service.id === (incoming ? connection.source : connection.target),
              );
              if (!peer) return null;
              return (
                <div
                  key={`${connection.source}-${connection.target}`}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="min-w-0">{getService(peer, environment).title}</span>
                  <span className="shrink-0 text-muted-foreground">{incoming ? "Inbound" : "Outbound"}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="flex min-w-0 flex-col gap-3">
          <h3 className="font-medium text-sm">Ownership & boundaries</h3>
          <code className="text-xs [overflow-wrap:anywhere]">{selectedService.location}</code>
          <p className="text-muted-foreground text-xs leading-relaxed">{selectedService.boundary}</p>
        </section>
      </CardContent>
      <CardFooter className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <Badge variant="secondary">{selectedService.layer}</Badge>
        <div className="flex flex-wrap gap-2">
          {onFocus && (
            <Button size="sm" variant="outline" onClick={onFocus}>
              <Focus data-icon="inline-start" />
              Focus node
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <a href="http://localhost:4000/api/v1/docs" target="_blank" rel="noopener noreferrer">
              API reference
              <ArrowUpRight data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
