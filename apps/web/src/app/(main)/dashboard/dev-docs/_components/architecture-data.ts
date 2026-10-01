import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BrainCircuit,
  CreditCard,
  Database,
  Globe,
  Layers3,
  Newspaper,
  Radio,
  Server,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from "lucide-react";

export type ArchitectureEnvironment = "local" | "server";
export type ArchitectureJourney = "all" | "research" | "alerts" | "payments";
export type ServiceId =
  | "client"
  | "bots"
  | "stripe"
  | "edge"
  | "web"
  | "api"
  | "worker"
  | "postgres"
  | "redis"
  | "market"
  | "ai"
  | "news"
  | "storage"
  | "sources"
  | "integrations";

export interface ArchitectureService {
  id: ServiceId;
  title: string;
  subtitle: string;
  layer: "Experience" | "Ingress" | "Application" | "Data" | "Provider";
  icon: LucideIcon;
  location: string;
  responsibilities: string[];
  boundary: string;
}

export const services: ArchitectureService[] = [
  {
    id: "client",
    title: "Clients",
    subtitle: "Dashboard users · API consumers",
    layer: "Experience",
    icon: Globe,
    location: "Browser / customer application",
    responsibilities: [
      "Customers explore markets, news, analytics and AI conversations.",
      "Administrators manage accounts, payments, logs and service health.",
      "Customer API clients authenticate with scoped bearer keys.",
    ],
    boundary: "Browser sessions and API keys use separate authorization paths.",
  },
  {
    id: "bots",
    title: "Telegram & Discord",
    subtitle: "Private commands · Alert destinations",
    layer: "Experience",
    icon: Bot,
    location: "packages/bots · apps/api/src/bots",
    responsibilities: [
      "Verified provider webhooks deliver commands to the API.",
      "Secure account linking requires confirmation in the dashboard.",
      "API command consumers respond; Worker delivers external alerts.",
    ],
    boundary: "Tokens stay on the server. Discord responses are private; alert proposals need user confirmation.",
  },
  {
    id: "stripe",
    title: "Stripe sandbox",
    subtitle: "Checkout · Signed billing events",
    layer: "Experience",
    icon: CreditCard,
    location: "apps/api/src/billing",
    responsibilities: [
      "Hosted test checkout and subscription management.",
      "Signed events reconcile customer subscription state.",
      "A durable invoice ledger backs payment administration.",
    ],
    boundary: "Test billing only. Live Stripe keys are rejected by the current implementation.",
  },
  {
    id: "edge",
    title: "Cloudflare + Nginx",
    subtitle: "HTTPS ingress · Origin protection",
    layer: "Ingress",
    icon: ShieldCheck,
    location: "docker/nginx.conf.example",
    responsibilities: [
      "Routes app and API hostnames to separate loopback ports.",
      "Preserves streaming and signed webhook request bodies.",
      "Replaces forwarded headers and request IDs at the trusted proxy.",
    ],
    boundary:
      "This is the deployment design. Local development uses an API tunnel; public setup is not inferred from this diagram.",
  },
  {
    id: "web",
    title: "Web dashboard",
    subtitle: "Next.js · React · shadcn/ui",
    layer: "Application",
    icon: Layers3,
    location: "apps/web",
    responsibilities: [
      "Dashboard, account settings, developer API and administration UI.",
      "Research conversation history and source evidence presentation.",
      "Browser requests use the configured API origin.",
    ],
    boundary: "No provider credentials in browser bundles. This docs route returns 404 outside development.",
  },
  {
    id: "api",
    title: "Application API",
    subtitle: "NestJS · Auth · Research orchestration",
    layer: "Application",
    icon: Server,
    location: "apps/api",
    responsibilities: [
      "Authentication, permissions, plan entitlements and scoped API access.",
      "AI research, source validation, conversations and alert proposals.",
      "Bot command consumers, billing webhooks and account linking.",
    ],
    boundary: "The API consumes bot-command jobs. Research budget admission and source validation happen here.",
  },
  {
    id: "worker",
    title: "Background Worker",
    subtitle: "Refresh · Evaluate · Deliver",
    layer: "Application",
    icon: Workflow,
    location: "apps/worker · packages/jobs",
    responsibilities: [
      "Refreshes market observations and ingests permitted RSS feeds.",
      "Evaluates alert rules and persists trigger / delivery intent.",
      "Processes dashboard inbox and external notification delivery.",
    ],
    boundary:
      "Worker does not call AI. Delivery retries are bounded; ambiguous provider acceptance must not be blindly replayed.",
  },
  {
    id: "postgres",
    title: "PostgreSQL",
    subtitle: "Prisma · Durable system of record",
    layer: "Data",
    icon: Database,
    location: "packages/db · prisma migrations",
    responsibilities: [
      "Accounts, watchlists, alerts, notifications and bot links.",
      "Research history, budgets, invoices and subscription state.",
      "Durable command / delivery records survive queue loss.",
    ],
    boundary:
      "API and Worker access the database; Web does not connect directly. Migrations run explicitly before deployment.",
  },
  {
    id: "redis",
    title: "Redis & BullMQ",
    subtitle: "Queues · Cache · Rate buckets",
    layer: "Data",
    icon: Radio,
    location: "packages/jobs · shared Redis",
    responsibilities: [
      "Schedules and dispatches market, alert and delivery jobs.",
      "API processes bot-commands; Worker processes external notifications.",
      "Supports caching, locks and request rate limiting.",
    ],
    boundary: "Redis is not the system of record. PostgreSQL preserves durable intent and attempt budgets.",
  },
  {
    id: "market",
    title: "Market sources",
    subtitle: "Coinbase Exchange · TradingView",
    layer: "Provider",
    icon: TrendingUp,
    location: "packages/market-data",
    responsibilities: [
      "Public Coinbase crypto ticker and OHLCV requests.",
      "TradingView adapter resolves configured FX, metals and equities.",
      "Shared deterministic indicators and trend calculations use observed candles.",
    ],
    boundary:
      "Catalog inclusion does not guarantee upstream availability. No Twelve Data key is required for these adapters.",
  },
  {
    id: "ai",
    title: "OpenRouter",
    subtitle: "Configured model · Sourced interpretation",
    layer: "Provider",
    icon: BrainCircuit,
    location: "packages/ai",
    responsibilities: [
      "Receives bounded, validated research context through the API.",
      "Returns interpretation against observed market / stored news evidence.",
      "Model capability, quota and cost limits control admission.",
    ],
    boundary: "Private research has retention limits. Provider failures do not become invented market observations.",
  },
  {
    id: "news",
    title: "RSS news sources",
    subtitle: "Investing.com · Stored coverage",
    layer: "Provider",
    icon: Newspaper,
    location: "packages/news",
    responsibilities: [
      "Worker ingests configured permitted feeds and deduplicates articles.",
      "Stored titles and descriptions support asset coverage and search.",
      "AI research reads bounded stored coverage through the API.",
    ],
    boundary: "Ingestion is disabled by default pending permission. Sentiment scoring is currently unavailable.",
  },
  {
    id: "storage",
    title: "Data & job queues",
    subtitle: "PostgreSQL saves data. Redis organizes background work.",
    layer: "Data",
    icon: Database,
    location: "packages/db · packages/jobs",
    responsibilities: [
      "PostgreSQL stores accounts, research, notifications and payments.",
      "Redis provides queues, caching and rate limiting.",
      "API and Worker share this private data layer.",
    ],
    boundary: "PostgreSQL is the durable system of record. Redis is not a replacement for the database.",
  },
  {
    id: "sources",
    title: "Market & AI sources",
    subtitle: "Prices, news and sourced AI interpretation.",
    layer: "Provider",
    icon: BrainCircuit,
    location: "packages/market-data · packages/news · packages/ai",
    responsibilities: [
      "Coinbase and TradingView provide observed market data.",
      "Permitted RSS ingestion supplies stored news coverage.",
      "OpenRouter interprets validated evidence through the API.",
    ],
    boundary:
      "Provider credentials stay on the server. Availability is checked during actual requests; missing data is not fabricated.",
  },
  {
    id: "integrations",
    title: "Bots & test payments",
    subtitle: "Telegram, Discord and Stripe connect to the API.",
    layer: "Provider",
    icon: Bot,
    location: "packages/bots · apps/api/src/billing",
    responsibilities: [
      "Verified Telegram and Discord webhooks deliver private commands.",
      "Worker delivers eligible external alert notifications.",
      "Stripe test events update subscriptions and invoices.",
    ],
    boundary: "Account linking needs dashboard confirmation. Current Stripe support is sandbox only.",
  },
];

export const journeys = [
  {
    id: "all",
    label: "Platform overview",
    description:
      "The dashboard talks to API. API uses private data and external sources; Worker handles background jobs. Bots and test payments connect through verified integrations. Select a workflow to see its individual services.",
  },
  {
    id: "research",
    label: "AI research",
    description:
      "A dashboard or bot question reaches API orchestration, observed market data, stored news and OpenRouter. Validated research is saved in PostgreSQL.",
  },
  {
    id: "alerts",
    label: "Alert delivery",
    description:
      "Worker refreshes observations, evaluates persisted rules and writes durable delivery intent. Inbox and external delivery run independently, with bounded retries.",
  },
  {
    id: "payments",
    label: "Sandbox billing",
    description:
      "API creates test checkout. Signed Stripe events reconcile subscriptions and invoices in PostgreSQL; entitlements control access across the product.",
  },
] satisfies { id: ArchitectureJourney; label: string; description: string }[];

export function getService(service: ArchitectureService, environment: ArchitectureEnvironment): ArchitectureService {
  if (service.id !== "edge" || environment === "server") return service;
  return {
    ...service,
    title: "ngrok API tunnel",
    subtitle: "Public HTTPS → localhost:4000",
    location: "Local operator terminal",
    responsibilities: [
      "Makes the local API reachable by Telegram, Discord and Stripe.",
      "Forwards verified provider callbacks to API webhook routes.",
      "A changed URL requires provider webhook registration updates.",
    ],
    boundary: "Dashboard-only development does not need a tunnel. The tunnel exposes API, not Web or database ports.",
  };
}
