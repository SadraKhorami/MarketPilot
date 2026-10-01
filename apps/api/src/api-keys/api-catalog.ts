export const API_SCOPES = ["market:read", "news:read", "watchlists:read", "alerts:read"] as const;
export const API_KEY_RATE_LIMIT = 120;
export const API_RATE_WINDOW_SECONDS = 60;
export const API_CATALOG = {
  version: "v1",
  authentication: "Bearer API key",
  rateLimit: { requests: API_KEY_RATE_LIMIT, windowSeconds: API_RATE_WINDOW_SECONDS, per: "API key" },
  endpoints: [
    {
      method: "GET",
      path: "/market-data/catalog",
      scope: "market:read",
      title: "Market catalog",
      description: "Active crypto instruments and configured multi-asset coverage, with source and availability.",
      parameters: "None",
    },
    {
      method: "GET",
      path: "/market-data/{symbol}",
      scope: "market:read",
      title: "Prices & analysis",
      description: "Provider-backed price, candles, indicators and trend. Includes source and freshness.",
      parameters: "symbol: BTC-USD; interval: 1m, 5m, 15m, 1h, 6h or 1d",
    },
    {
      method: "GET",
      path: "/news",
      scope: "news:read",
      title: "Market news",
      description: "Sourced headlines and article links. Sentiment is unavailable until scoring is implemented.",
      parameters: "search, asset, category, page, pageSize (1–50)",
    },
    {
      method: "GET",
      path: "/watchlists",
      scope: "watchlists:read",
      title: "Your watchlists",
      description: "Watchlists belonging to the key owner.",
      parameters: "None",
    },
    {
      method: "GET",
      path: "/alerts",
      scope: "alerts:read",
      title: "Your alert rules",
      description:
        "Owned alert rules with latest evaluation and trigger state. Returns data.items with pagination metadata.",
      parameters: "search, status: all|active|paused, page, pageSize (1–50)",
    },
  ],
};
