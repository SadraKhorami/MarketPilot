"use client";

import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ArchitectureService } from "./architecture-data";
import type { DiagramConnection } from "./architecture-diagram";

export function ArchitectureInspector({
  selectedService,
  availableServices,
  connections,
  open,
  onOpenChange,
}: {
  selectedService: ArchitectureService;
  availableServices: ArchitectureService[];
  connections: DiagramConnection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = selectedService.icon;
  const relatedConnections = connections.filter(
    (connection) => connection.source === selectedService.id || connection.target === selectedService.id,
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="gap-3 pr-12">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Icon className="size-5" />
            </div>
            <SheetTitle>{selectedService.title}</SheetTitle>
          </div>
          <SheetDescription>{selectedService.subtitle}</SheetDescription>
          <Badge variant="secondary" className="self-start">
            {selectedService.layer}
          </Badge>
        </SheetHeader>
        <Tabs key={selectedService.id} defaultValue="overview" className="min-h-0 flex-1 gap-4 px-4 pb-4">
          <TabsList className="w-full" aria-label="Service details">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="technical">Technical</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="min-h-0 overflow-y-auto">
            <ul className="flex list-disc flex-col gap-4 pl-5 text-sm leading-relaxed">
              {selectedService.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="connections" className="min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {relatedConnections.map((connection) => {
                const incoming = connection.target === selectedService.id;
                const peer = availableServices.find(
                  (service) => service.id === (incoming ? connection.source : connection.target),
                );
                if (!peer) return null;
                return (
                  <div
                    key={`${connection.source}-${connection.target}`}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{peer.title}</span>
                      <Badge variant="outline">{incoming ? "Incoming" : "Outgoing"}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{connection.label}</p>
                  </div>
                );
              })}
            </div>
          </TabsContent>
          <TabsContent value="technical" className="min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">Code location</h3>
                <code className="rounded-lg bg-muted p-3 text-xs [overflow-wrap:anywhere]">
                  {selectedService.location}
                </code>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{selectedService.boundary}</p>
              <Button asChild variant="outline" className="self-start">
                <a href="http://localhost:4000/api/v1/docs" target="_blank" rel="noopener noreferrer">
                  API reference
                  <ArrowUpRight data-icon="inline-end" />
                </a>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
