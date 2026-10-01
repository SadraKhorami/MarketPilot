import type { ArchitectureEnvironment, ArchitectureJourney, ArchitectureService, ServiceId } from "./architecture-data";
import { getService, services } from "./architecture-data";

export type PortSide = "top" | "right" | "bottom" | "left";
export interface DiagramConnection {
  source: ServiceId;
  target: ServiceId;
  label: string;
  sourceSide?: PortSide;
  targetSide?: PortSide;
}
export interface DiagramPort {
  id: string;
  side: PortSide;
  type: "source" | "target";
  offset: number;
}
export interface DiagramService extends ArchitectureService {
  position: { x: number; y: number };
  ports: DiagramPort[];
}

const overview: [ServiceId, number, number][] = [
  ["web", 350, 0],
  ["integrations", 700, 0],
  ["api", 350, 230],
  ["sources", 0, 470],
  ["storage", 350, 470],
  ["worker", 700, 470],
];
const research: [ServiceId, number, number][] = [
  ["web", 350, 0],
  ["api", 350, 230],
  ["market", 0, 470],
  ["ai", 350, 470],
  ["postgres", 700, 470],
];
const alerts: [ServiceId, number, number][] = [
  ["market", 350, 0],
  ["worker", 350, 230],
  ["postgres", 0, 470],
  ["redis", 350, 470],
  ["bots", 700, 470],
];
const payments: [ServiceId, number, number][] = [
  ["web", 350, 0],
  ["api", 350, 230],
  ["stripe", 0, 470],
  ["postgres", 700, 470],
];

export function getDiagram(journey: ArchitectureJourney, environment: ArchitectureEnvironment) {
  let layout = overview;
  let connections: DiagramConnection[] = [
    { source: "web", target: "api", label: "The dashboard sends authenticated requests to the API." },
    {
      source: "integrations",
      target: "api",
      label: "Verified bot commands and Stripe test events enter through the API.",
    },
    {
      source: "api",
      target: "sources",
      label: "API retrieves market observations and requests sourced AI interpretation.",
    },
    { source: "api", target: "storage", label: "API saves account data and research, and queues background work." },
    {
      source: "worker",
      target: "storage",
      label: "Worker consumes queues and persists alert and delivery records.",
      sourceSide: "left",
      targetSide: "right",
    },
    {
      source: "worker",
      target: "integrations",
      label: "Worker sends eligible alerts to linked Telegram and Discord accounts.",
      sourceSide: "right",
      targetSide: "right",
    },
  ];
  if (journey === "research") {
    layout = research;
    connections = [
      { source: "web", target: "api", label: "Your question reaches API research orchestration." },
      { source: "api", target: "market", label: "API retrieves actual prices and candle history." },
      { source: "api", target: "ai", label: "OpenRouter interprets validated observations and stored news." },
      { source: "api", target: "postgres", label: "API reads stored coverage and saves your research history." },
    ];
  } else if (journey === "alerts") {
    layout = alerts;
    connections = [
      {
        source: "market",
        target: "worker",
        label: "Observed market data feeds Worker evaluation. This arrow shows data flow.",
      },
      {
        source: "worker",
        target: "postgres",
        label: "Worker reads rules and persists triggers and inbox / delivery intent.",
      },
      { source: "worker", target: "redis", label: "Redis schedules work and dispatches bounded delivery attempts." },
      {
        source: "worker",
        target: "bots",
        label: "Worker delivers eligible alerts after checking links, plans and preferences.",
      },
    ];
  } else if (journey === "payments") {
    layout = payments;
    connections = [
      { source: "web", target: "api", label: "The signed-in dashboard asks API to create test checkout." },
      { source: "api", target: "stripe", label: "API creates hosted Stripe test checkout; no real payment is taken." },
      {
        source: "stripe",
        target: "api",
        label: "Signed Stripe callbacks reconcile subscription state.",
        sourceSide: "left",
        targetSide: "left",
      },
      {
        source: "api",
        target: "postgres",
        label: "API persists verified subscriptions, invoices and plan entitlements.",
      },
    ];
  }
  const descriptions: Partial<Record<ServiceId, { title: string; subtitle: string }>> = {
    web: { title: "Dashboard", subtitle: "Explore markets, research and your account." },
    api: { title: "Application API", subtitle: "Handles accounts, requests and AI research." },
    worker: { title: "Background jobs", subtitle: "Updates prices, checks rules and delivers alerts." },
    market: { title: "Market data", subtitle: "Observed prices and candle history." },
    ai: { title: "AI interpretation", subtitle: "Explains validated market and news evidence." },
    postgres: { title: "Saved data", subtitle: "PostgreSQL stores accounts, research and delivery records." },
    redis: { title: "Job queue", subtitle: "Redis schedules work, caches data and limits requests." },
  };
  const nodes: DiagramService[] = layout.map(([id, x, y]) => {
    const service = services.find((item) => item.id === id);
    if (!service) throw new Error(`Architecture service is missing: ${id}`);
    const ports: DiagramPort[] = [];
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const attached = connections.flatMap<Pick<DiagramPort, "id" | "type">>((connection, index) => {
        if (connection.source === id && (connection.sourceSide ?? "bottom") === side)
          return [{ id: `out-${index}`, type: "source" as const }];
        if (connection.target === id && (connection.targetSide ?? "top") === side)
          return [{ id: `in-${index}`, type: "target" as const }];
        return [];
      });
      attached.forEach((port, index) => {
        ports.push({ ...port, side, offset: ((index + 1) / (attached.length + 1)) * 100 });
      });
    }
    return { ...getService(service, environment), ...descriptions[id], position: { x, y }, ports };
  });
  return { nodes, connections };
}
