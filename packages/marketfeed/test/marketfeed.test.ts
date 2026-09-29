import assert from "node:assert/strict";
import test from "node:test";

import { MarketFeedClient, MarketFeedError } from "../src/index";

const fixture = {
  symbol: "BINANCE:BTCUSDT",
  interval: "15",
  price: 100,
  timestamp: "2026-09-29T10:00:00.000Z",
  candles: [{ time: "2026-09-29T09:45:00.000Z", open: 99, high: 101, low: 98, close: 100, volume: 2 }],
  indicators: {
    rsi: 50,
    macd: { value: 1, signal: 0.5, histogram: 0.5 },
    sma50: 99,
    sma200: 98,
    bollingerBands: { upper: 102, middle: 100, lower: 98 },
    stochastic: { k: 51, d: 49 },
    atr: 1,
  },
  trend: "uptrend",
  supportResistance: { support: [95], resistance: [105] },
  marketStatus: { isOpen: true },
  volatility: { atr: 1, atr_percentage: "1.00" },
};

test("sends the documented Bearer auth and interval then validates provider response", async () => {
  let requestUrl = "";
  let authorization = "";
  const client = new MarketFeedClient({
    baseUrl: "http://127.0.0.1:3199",
    token: "secret",
    fetcher: async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json(fixture);
    },
  });
  const response = await client.getMarketData("BTCUSDT", "15");
  assert.equal(new URL(requestUrl).pathname, "/api/market-data/BTCUSDT");
  assert.equal(new URL(requestUrl).searchParams.get("interval"), "15");
  assert.equal(authorization, "Bearer secret");
  assert.equal(response.price, 100);
});

test("rejects unsupported symbols, missing configuration, and malformed provider data", async () => {
  const client = new MarketFeedClient({ baseUrl: "https://feed.example", token: "x", fetcher: async () => Response.json({ ...fixture, price: "100" }) });
  await assert.rejects(() => client.getMarketData("BTC USDT", "15"), (error: unknown) => error instanceof MarketFeedError && error.code === "INVALID_REQUEST");
  await assert.rejects(() => new MarketFeedClient({}).getMarketData("BTCUSDT", "15"), (error: unknown) => error instanceof MarketFeedError && error.code === "CONFIGURATION");
  await assert.rejects(() => client.getMarketData("BTCUSDT", "15"), (error: unknown) => error instanceof MarketFeedError && error.code === "INVALID_RESPONSE");
});

test("normalizes unauthorized and rate-limit errors without exposing response content", async () => {
  const unauthorized = new MarketFeedClient({ baseUrl: "https://feed.example", token: "sensitive", fetcher: async () => new Response("token echoed", { status: 401 }) });
  await assert.rejects(() => unauthorized.getMarketData("BTCUSDT", "15"), (error: unknown) => error instanceof MarketFeedError && error.code === "UNAUTHORIZED" && !error.message.includes("token echoed"));
  const limited = new MarketFeedClient({ baseUrl: "https://feed.example", token: "x", retries: 0, fetcher: async () => new Response(null, { status: 429 }) });
  await assert.rejects(() => limited.getMarketData("BTCUSDT", "15"), (error: unknown) => error instanceof MarketFeedError && error.code === "RATE_LIMITED");
});
