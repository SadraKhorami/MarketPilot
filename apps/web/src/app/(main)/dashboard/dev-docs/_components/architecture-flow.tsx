"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  Background,
  BackgroundVariant,
  MarkerType,
  type NodeChange,
  type NodeMouseHandler,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import { CircleHelp, Info, Layers3, Maximize, Minus, Pause, Play, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { type ArchitectureEnvironment, type ArchitectureJourney, journeys, type ServiceId } from "./architecture-data";
import { getDiagram } from "./architecture-diagram";
import { ArchitectureEdge, type ArchitectureFlowEdge } from "./architecture-edge";
import { ArchitectureInspector } from "./architecture-inspector";
import { ArchitectureNode, type ServiceNode } from "./architecture-node";

import "@xyflow/react/dist/base.css";

const nodeTypes = { service: ArchitectureNode };
const edgeTypes = { flow: ArchitectureEdge };
const fitOptions = { padding: 0.18, maxZoom: 1 };

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getServerReducedMotion = () => true;

function subscribeCompactView(callback: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getCompactView = () => window.matchMedia("(max-width: 767px)").matches;
const getServerCompactView = () => false;

export function ArchitectureFlow() {
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  const compactView = useSyncExternalStore(subscribeCompactView, getCompactView, getServerCompactView);
  const [environment, setEnvironment] = useState<ArchitectureEnvironment>("server");
  const [journey, setJourney] = useState<ArchitectureJourney>("all");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<ServiceId>("api");
  const instance = useRef<ReactFlowInstance<ServiceNode, ArchitectureFlowEdge> | null>(null);
  const diagram = useMemo(() => getDiagram(journey, environment), [journey, environment]);
  const { connections, nodes: diagramServices } = diagram;
  const selectedService = diagramServices.find((service) => service.id === selectedId) ?? diagramServices[0];
  const animationLabel = animationEnabled ? "Pause flow" : "Play flow";
  const journeyDescription = journeys.find((item) => item.id === journey)?.description;
  const inspectService = useCallback((id: ServiceId) => {
    setSelectedId(id);
    setInspectorOpen(true);
  }, []);

  const nodes = useMemo<ServiceNode[]>(
    () =>
      diagramServices.map((service) => ({
        id: service.id,
        type: "service",
        position: service.position,
        data: {
          service,
          active: true,
          onInspect: inspectService,
        },
        selected: selectedService.id === service.id,
        ariaLabel: `${service.title}. Use the info button for details.`,
        className: "rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        draggable: false,
        deletable: false,
      })),
    [diagramServices, selectedService.id, inspectService],
  );

  const edges = useMemo<ArchitectureFlowEdge[]>(
    () =>
      connections.map((connection, index) => {
        const highlighted =
          journey !== "all" || connection.source === selectedService.id || connection.target === selectedService.id;
        const color = highlighted ? "var(--primary)" : "var(--muted-foreground)";
        return {
          id: `${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: `out-${index}`,
          targetHandle: `in-${index}`,
          type: "flow",
          data: { animate: highlighted && animationEnabled && !reducedMotion },
          style: { stroke: color, strokeWidth: highlighted ? 2 : 1.5, opacity: highlighted ? 1 : 0.65 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          focusable: false,
          selectable: false,
          deletable: false,
        };
      }),
    [connections, animationEnabled, journey, reducedMotion, selectedService.id],
  );

  const onNodeClick = useCallback<NodeMouseHandler<ServiceNode>>((_event, node) => {
    setSelectedId(node.data.service.id);
  }, []);
  const onNodesChange = useCallback(
    (changes: NodeChange<ServiceNode>[]) => {
      const selected = changes.find((change) => change.type === "select" && change.selected);
      if (selected?.type === "select") {
        const service = diagramServices.find((item) => item.id === selected.id);
        if (service) {
          setSelectedId(service.id);
        }
      }
    },
    [diagramServices],
  );
  const onInit = useCallback((flow: ReactFlowInstance<ServiceNode, ArchitectureFlowEdge>) => {
    instance.current = flow;
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-col gap-2">
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="size-5 shrink-0" />
              Inside MarketPilot
            </CardTitle>
            <CardDescription className="max-w-2xl">
              Choose a workflow. Use a node’s info button to explore its role and connections.
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={environment}
            variant="outline"
            size="sm"
            aria-label="Architecture environment"
            onValueChange={(value) => {
              if (value === "local" || value === "server") setEnvironment(value);
            }}
            className="shrink-0"
          >
            <ToggleGroupItem value="local">Local</ToggleGroupItem>
            <ToggleGroupItem value="server">Ubuntu</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 overflow-x-auto pb-1">
              <ToggleGroup
                type="single"
                value={journey}
                variant="outline"
                size="sm"
                aria-label="Highlight an architecture journey"
                onValueChange={(value) => {
                  const item = journeys.find((option) => option.id === value);
                  if (item) setJourney(item.id);
                }}
              >
                {journeys.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0 self-start">
                  <CircleHelp data-icon="inline-start" />
                  How it works
                </Button>
              </SheetTrigger>
              <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
                <SheetHeader className="pr-12">
                  <SheetTitle>How this workflow works</SheetTitle>
                  <SheetDescription>{journeyDescription}</SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-col gap-6 overflow-y-auto px-4 pb-4">
                  <ol className="flex flex-col gap-4">
                    {connections.map((connection, index) => (
                      <li key={`${connection.source}-${connection.target}`} className="flex items-start gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-relaxed">{connection.label}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-col gap-2 rounded-lg border p-4">
                    <h3 className="font-medium">{environment === "local" ? "Running locally" : "Ubuntu deployment"}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {environment === "local"
                        ? "Dashboard and API run on your machine; PostgreSQL and Redis run in Docker. A public tunnel lets Telegram, Discord and Stripe reach local webhooks."
                        : "Cloudflare routes public traffic to Nginx over HTTPS. Nginx forwards requests to the dashboard and API; the database and job queue stay private."}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Animated dots illustrate data flow; they do not show live traffic.
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <p className="max-w-4xl text-muted-foreground text-sm leading-relaxed">{journeyDescription}</p>
          {compactView ? (
            <fieldset className="grid gap-3">
              <legend className="sr-only">Architecture services</legend>
              {diagramServices.map((service) => {
                const Icon = service.icon;
                return (
                  <div key={service.id} className="flex items-start gap-3 rounded-xl border bg-background p-4">
                    <Icon className="mt-1 size-5 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-semibold text-base">{service.title}</span>
                      <span className="text-muted-foreground text-sm leading-relaxed">{service.subtitle}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 rounded-full"
                      aria-label={`Details for ${service.title}`}
                      title="Service details"
                      onClick={() => inspectService(service.id)}
                    >
                      <Info />
                    </Button>
                  </div>
                );
              })}
            </fieldset>
          ) : (
            <div className="relative aspect-[3/2] max-h-[50rem] min-h-[38rem] w-full overflow-hidden rounded-xl border bg-background [&_.react-flow__attribution]:rounded-tl-lg [&_.react-flow__attribution]:bg-card [&_.react-flow__attribution]:px-2 [&_.react-flow__attribution]:py-1 [&_.react-flow__attribution_a]:text-muted-foreground">
              <ReactFlow<ServiceNode, ArchitectureFlowEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={onInit}
                onNodeClick={onNodeClick}
                onNodesChange={onNodesChange}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesReconnectable={false}
                edgesFocusable={false}
                deleteKeyCode={null}
                minZoom={0.2}
                maxZoom={1.5}
                fitView
                fitViewOptions={fitOptions}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                preventScrolling={false}
                aria-label="MarketPilot architecture. Drag to pan; use zoom controls or pinch to zoom."
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
              </ReactFlow>
            </div>
          )}
        </CardContent>
        {!compactView && (
          <CardFooter className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-muted-foreground text-xs">
              Drag to pan · Info opens service details · Movement illustrates a flow, not live traffic
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                aria-pressed={animationEnabled && !reducedMotion}
                disabled={reducedMotion}
                onClick={() => setAnimationEnabled((enabled) => !enabled)}
              >
                {animationEnabled && !reducedMotion ? (
                  <Pause data-icon="inline-start" />
                ) : (
                  <Play data-icon="inline-start" />
                )}
                {reducedMotion ? "Reduced motion" : animationLabel}
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Zoom out"
                onClick={() => void instance.current?.zoomOut()}
              >
                <Minus />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Zoom in"
                onClick={() => void instance.current?.zoomIn()}
              >
                <Plus />
              </Button>
              <Button size="sm" variant="outline" onClick={() => void instance.current?.fitView(fitOptions)}>
                <Maximize data-icon="inline-start" />
                Fit map
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
      <ArchitectureInspector
        selectedService={selectedService}
        availableServices={diagramServices}
        connections={connections}
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
      />
    </div>
  );
}
