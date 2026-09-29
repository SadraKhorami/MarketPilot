export type MarketTrend = "Bullish" | "Bearish" | "Sideways";
export type MarketSentiment = "Positive" | "Mixed" | "Negative";

export interface PricePoint {
  time: string;
  price: number;
}

export interface TechnicalIndicator {
  name: string;
  value: string;
  signal: MarketTrend | "Neutral";
}

export interface MarketAsset {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change24h: number;
  marketCap: string;
  volume24h: string;
  trend: MarketTrend;
  sentiment: MarketSentiment;
  history: PricePoint[];
  indicators: TechnicalIndicator[];
}

function history(start: number, offsets: number[]): PricePoint[] {
  return offsets.map((offset, index) => ({
    time: `${String(8 + index * 2).padStart(2, "0")}:00`,
    price: Number((start + offset).toFixed(2)),
  }));
}

// These values are illustrative fixtures for the UI foundation. They are not market observations.
export const demoAssets: MarketAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    category: "Layer 1",
    price: 64218.42,
    change24h: 2.84,
    marketCap: "$1.27T",
    volume24h: "$28.4B",
    trend: "Bullish",
    sentiment: "Positive",
    history: history(63100, [0, 180, 90, 260, 220, 410, 330, 560, 490, 690, 650, 880]),
    indicators: [
      { name: "RSI (14)", value: "58.4", signal: "Neutral" },
      { name: "MACD", value: "+142.6", signal: "Bullish" },
      { name: "50-day MA", value: "$61,840", signal: "Bullish" },
      { name: "200-day MA", value: "$59,210", signal: "Bullish" },
    ],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    category: "Layer 1",
    price: 3482.16,
    change24h: 1.26,
    marketCap: "$418.6B",
    volume24h: "$12.1B",
    trend: "Bullish",
    sentiment: "Mixed",
    history: history(3420, [0, -6, 11, 4, 19, 12, 24, 18, 38, 29, 52, 62]),
    indicators: [
      { name: "RSI (14)", value: "54.1", signal: "Neutral" },
      { name: "MACD", value: "+8.2", signal: "Bullish" },
      { name: "50-day MA", value: "$3,398", signal: "Bullish" },
      { name: "200-day MA", value: "$3,306", signal: "Neutral" },
    ],
  },
  {
    symbol: "SOL",
    name: "Solana",
    category: "Layer 1",
    price: 148.73,
    change24h: -1.48,
    marketCap: "$68.2B",
    volume24h: "$2.8B",
    trend: "Sideways",
    sentiment: "Mixed",
    history: history(151, [0, 1, -2, 2, -1, -4, 0, -1, -3, 1, -2, -2.27]),
    indicators: [
      { name: "RSI (14)", value: "47.2", signal: "Neutral" },
      { name: "MACD", value: "-0.8", signal: "Neutral" },
      { name: "50-day MA", value: "$151.02", signal: "Neutral" },
      { name: "200-day MA", value: "$143.88", signal: "Bullish" },
    ],
  },
  {
    symbol: "XRP",
    name: "XRP",
    category: "Payments",
    price: 0.6241,
    change24h: -0.62,
    marketCap: "$35.1B",
    volume24h: "$1.1B",
    trend: "Bearish",
    sentiment: "Negative",
    history: history(
      0.631,
      [0, 0.002, -0.001, -0.003, -0.002, -0.004, -0.001, -0.002, -0.005, -0.003, -0.006, -0.0069],
    ),
    indicators: [
      { name: "RSI (14)", value: "43.8", signal: "Bearish" },
      { name: "MACD", value: "-0.004", signal: "Bearish" },
      { name: "50-day MA", value: "$0.64", signal: "Bearish" },
      { name: "200-day MA", value: "$0.59", signal: "Bullish" },
    ],
  },
  {
    symbol: "BNB",
    name: "BNB",
    category: "Exchange token",
    price: 586.34,
    change24h: 0.88,
    marketCap: "$85.7B",
    volume24h: "$1.4B",
    trend: "Sideways",
    sentiment: "Positive",
    history: history(580, [0, 2, -1, 3, 5, 4, 7, 3, 5, 7, 5, 6.34]),
    indicators: [
      { name: "RSI (14)", value: "51.3", signal: "Neutral" },
      { name: "MACD", value: "+1.4", signal: "Bullish" },
      { name: "50-day MA", value: "$579.80", signal: "Bullish" },
      { name: "200-day MA", value: "$562.10", signal: "Bullish" },
    ],
  },
  {
    symbol: "ADA",
    name: "Cardano",
    category: "Layer 1",
    price: 0.4512,
    change24h: 0.34,
    marketCap: "$16.1B",
    volume24h: "$328M",
    trend: "Sideways",
    sentiment: "Mixed",
    history: history(0.449, [0, 0.001, -0.001, 0.002, 0.001, 0.002, 0.001, 0.003, 0.002, 0.001, 0.002, 0.0022]),
    indicators: [
      { name: "RSI (14)", value: "49.6", signal: "Neutral" },
      { name: "MACD", value: "+0.001", signal: "Neutral" },
      { name: "50-day MA", value: "$0.45", signal: "Neutral" },
      { name: "200-day MA", value: "$0.43", signal: "Bullish" },
    ],
  },
];

export interface DemoNewsArticle {
  id: string;
  headline: string;
  category: string;
  asset: string;
  publishedAt: string;
  sentiment: MarketSentiment;
  summary: string;
}

export const demoNews: DemoNewsArticle[] = [
  {
    id: "news-01",
    headline: "Digital asset markets find direction as trading activity steadies",
    category: "Market structure",
    asset: "BTC",
    publishedAt: "2 hours ago",
    sentiment: "Positive",
    summary: "Illustrative article preview for the MarketPilot news interface. No external news provider is connected.",
  },
  {
    id: "news-02",
    headline: "Layer-one tokens diverge while majors hold a narrow range",
    category: "Altcoins",
    asset: "ETH",
    publishedAt: "4 hours ago",
    sentiment: "Mixed",
    summary: "A sample summary used to preview article detail, source context, and sentiment presentation.",
  },
  {
    id: "news-03",
    headline: "Risk appetite cools across high-beta assets in afternoon trade",
    category: "Sentiment",
    asset: "SOL",
    publishedAt: "6 hours ago",
    sentiment: "Negative",
    summary: "This fixture is not a report about current events and should not be treated as a market update.",
  },
  {
    id: "news-04",
    headline: "Payments tokens remain mixed as participants wait for fresh catalysts",
    category: "Digital assets",
    asset: "XRP",
    publishedAt: "Yesterday",
    sentiment: "Mixed",
    summary: "Demo content only. Live headlines and source links will be provided by a verified integration later.",
  },
];

export interface DemoAlert {
  id: string;
  asset: string;
  condition: string;
  threshold: string;
  status: "Active" | "Paused";
  channel: string;
  updatedAt: string;
}

export const demoAlerts: DemoAlert[] = [
  {
    id: "AL-2048",
    asset: "BTC",
    condition: "Price rises above",
    threshold: "$66,000",
    status: "Active",
    channel: "Dashboard",
    updatedAt: "Today, 09:42",
  },
  {
    id: "AL-2047",
    asset: "ETH",
    condition: "RSI falls below",
    threshold: "35",
    status: "Active",
    channel: "Telegram · demo",
    updatedAt: "Yesterday",
  },
  {
    id: "AL-2046",
    asset: "SOL",
    condition: "Price falls below",
    threshold: "$140",
    status: "Paused",
    channel: "Dashboard",
    updatedAt: "Sep 26",
  },
];

export const demoActivity = [
  {
    id: "act-01",
    title: "Watchlist updated",
    detail: "BTC added to Main watchlist",
    time: "Today · 10:24",
    icon: "watchlist",
  },
  { id: "act-02", title: "Alert created", detail: "ETH · RSI below 35", time: "Today · 09:42", icon: "alert" },
  {
    id: "act-03",
    title: "Telegram connection preview opened",
    detail: "No account was linked",
    time: "Yesterday · 16:10",
    icon: "bot",
  },
  {
    id: "act-04",
    title: "API key form viewed",
    detail: "No key was generated",
    time: "Yesterday · 14:32",
    icon: "api",
  },
] as const;

export const defaultWatchlist = ["BTC", "ETH", "SOL", "XRP"];

export function findAsset(symbol: string | undefined): MarketAsset | undefined {
  return demoAssets.find((asset) => asset.symbol.toLowerCase() === symbol?.toLowerCase());
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 4 : 2,
  }).format(price);
}

export function changeLabel(change: number): string {
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
}
