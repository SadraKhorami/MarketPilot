export const API_SCOPES = ["market:read", "news:read", "watchlists:read", "alerts:read"] as const;
export const API_KEY_RATE_LIMIT = 120;
export const API_RATE_WINDOW_SECONDS = 60;
export const API_CATALOG = {
  version: "v1",
  scopes: [
    { id: API_SCOPES[0], title: "Prices, candles & indicators" },
    { id: API_SCOPES[1], title: "Sourced market news" },
    { id: API_SCOPES[2], title: "Your watchlists" },
    { id: API_SCOPES[3], title: "Your saved alert rules & history" },
  ],
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
      response:
        "data.instruments: catalog entries; data.fetchedAt and data.error: discovery freshness and partial availability",
    },
    {
      method: "GET",
      path: "/market-data/{symbol}",
      scope: "market:read",
      title: "Prices & analysis",
      description: "Provider-backed price, candles, indicators and trend. Includes source and freshness.",
      parameters: "symbol: catalog identifier (e.g. BTC-USD); interval: 1m, 5m, 15m (default), 1h, 6h or 1d",
      response:
        "data: { source, requestedSymbol, freshness, fetchedAt, data: { price, timestamp, priceKind, candles, indicators, trend, … } }",
    },
    {
      method: "GET",
      path: "/news",
      scope: "news:read",
      title: "Market news",
      description: "Sourced headlines and article links. Sentiment is unavailable until scoring is implemented.",
      parameters: "search (≤120 chars), asset (≤80), category (≤100), page (default 1), pageSize (1–50; default 20)",
      response: "data: { articles, total, page, pageSize, totalPages, refreshState, sentiment: null, assetFilter }",
    },
    {
      method: "GET",
      path: "/watchlists",
      scope: "watchlists:read",
      title: "Your watchlists",
      description: "Watchlists belonging to the key owner.",
      parameters: "None",
      response: "data: array of owned watchlists with ordered items",
    },
    {
      method: "GET",
      path: "/alerts",
      scope: "alerts:read",
      title: "Your alert rules",
      description:
        "Owned alert rules with latest evaluation and trigger state. Returns data.items with pagination metadata.",
      parameters:
        "search (≤120 chars), status: all (default)|active|paused, page (1–100000; default 1), pageSize (1–50; default 20)",
      response: "data: { items, total, page, pageSize, totalPages }",
    },
    {
      method: "GET",
      path: "/alerts/summary",
      scope: "alerts:read",
      title: "Alert counts",
      description: "Active and paused rule counts for the key owner.",
      parameters: "None",
      response: "data: { total, active, paused }",
    },
    {
      method: "GET",
      path: "/alerts/{id}",
      scope: "alerts:read",
      title: "Alert detail",
      description: "A single owned rule with its latest evaluation state.",
      parameters: "id: owned alert UUID",
      response: "data: owned alert rule; 404 for absent or unowned rules",
    },
    {
      method: "GET",
      path: "/alerts/{id}/history",
      scope: "alerts:read",
      title: "Alert trigger history",
      description: "Observed triggers belonging to an owned alert. Provider acceptance is not proof of reading.",
      parameters:
        "id: owned alert UUID; page (1–100000; default 1), pageSize (1–50; default 20), search accepted but not applied",
      response: "data: { items, total, page, pageSize, totalPages }",
    },
  ],
};
