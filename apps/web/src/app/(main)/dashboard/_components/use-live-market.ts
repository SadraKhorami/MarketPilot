"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { MarketCandle, MarketObservation } from "@marketpilot/market-data";

const durations = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3600_000, "6h": 21600_000, "1d": 86400_000 };
type Connection = "connecting" | "live" | "reconnecting" | "paused" | "periodic";
interface LiveState {
  symbol: string;
  interval: string;
  candle: MarketCandle;
  price: number;
  time: string;
  receivedAt: number;
}

/** Public price stream. REST remains the authority for complete OHLCV and indicators. */
export function useLiveMarket(base: MarketObservation | undefined, enabled: boolean, refresh: () => void) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const latestBase = useRef(base);
  latestBase.current = base;
  const resync = useEffectEvent(refresh);
  const supported = base?.source === "coinbase-exchange";
  const symbol = base?.providerSymbol;
  const interval = base?.interval;
  useEffect(() => {
    if (!enabled || !supported || !symbol || !interval) return;
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let received = 0;
    let sequence = 0;
    let lastTradeTime = 0;
    let draft: LiveState | null = null;
    let dirty = false;
    let lastResync = 0;
    const reconcile = () => {
      if (Date.now() - lastResync < 5000) return;
      lastResync = Date.now();
      resync();
    };
    function connect() {
      if (stopped || document.visibilityState !== "visible") return;
      setConnection(attempts ? "reconnecting" : "connecting");
      sequence = 0;
      received = Date.now();
      socket = new WebSocket("wss://ws-feed.exchange.coinbase.com");
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: "subscribe", product_ids: [symbol], channels: ["ticker", "heartbeat"] }));
        reconcile();
      };
      socket.onmessage = (event) => {
        if (stopped || typeof event.data !== "string") return;
        let value: unknown;
        try {
          value = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!value || typeof value !== "object") return;
        const message = value as Record<string, unknown>;
        if (message.type === "error") {
          socket?.close();
          return;
        }
        if (message.product_id !== symbol) return;
        received = Date.now();
        attempts = 0;
        if (message.type === "heartbeat") {
          setConnection("live");
          return;
        }
        if (message.type !== "ticker" || typeof message.price !== "string" || typeof message.time !== "string") return;
        const price = Number(message.price);
        const time = Date.parse(message.time);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(time) || time < lastTradeTime) return;
        if (typeof message.sequence === "number") {
          if (message.sequence <= sequence) return;
          sequence = message.sequence;
        }
        lastTradeTime = time;
        const data = latestBase.current;
        if (!data || data.providerSymbol !== symbol || data.interval !== interval) return;
        const last = data.candles.at(-1);
        if (!last || time < Date.parse(last.time)) return;
        const duration = durations[interval];
        const bucket = Date.parse(last.time) + Math.floor((time - Date.parse(last.time)) / duration) * duration;
        if (bucket > Date.parse(last.time) + duration) {
          reconcile();
          return;
        }
        // Merge provider corrections into the developing candle; never invent missing candles or volume.
        const seed =
          draft && Date.parse(draft.candle.time) === bucket
            ? draft.candle
            : bucket === Date.parse(last.time)
              ? last
              : {
                  time: new Date(bucket).toISOString(),
                  open: price,
                  high: price,
                  low: price,
                  close: price,
                  volume: null,
                };
        const providerCandle = bucket === Date.parse(last.time) ? last : null;
        draft = {
          symbol: data.symbol,
          interval,
          price,
          time: message.time,
          receivedAt: received,
          candle: {
            ...seed,
            high: Math.max(seed.high, price, providerCandle?.high ?? price),
            low: Math.min(seed.low, price, providerCandle?.low ?? price),
            close: price,
            volume: providerCandle?.volume ?? seed.volume,
          },
        };
        dirty = true;
        setConnection("live");
        if (!providerCandle) reconcile();
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        socket = null;
        if (stopped || document.visibilityState !== "visible") return;
        setConnection("reconnecting");
        attempts++;
        retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)));
      };
    }
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (socket?.readyState === WebSocket.OPEN && Date.now() - received > 15_000) socket.close();
      if (dirty && draft) {
        setLive(draft);
        dirty = false;
      }
    }, 1000);
    const visibility = () => {
      clearTimeout(retry);
      if (document.visibilityState !== "visible") {
        setConnection("paused");
        socket?.close();
      } else {
        reconcile();
        if (!socket || socket.readyState === WebSocket.CLOSED) connect();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      socket?.close();
    };
  }, [enabled, supported, symbol, interval]);
  const valid =
    base &&
    live &&
    live.symbol === base.symbol &&
    live.interval === base.interval &&
    Date.parse(live.time) >= Date.parse(base.timestamp) &&
    Date.parse(live.candle.time) >= Date.parse(base.candles.at(-1)!.time);
  const data = valid
    ? {
        ...base,
        price: live.price,
        timestamp: live.time,
        candles:
          Date.parse(live.candle.time) === Date.parse(base.candles.at(-1)!.time)
            ? [...base.candles.slice(0, -1), live.candle]
            : [...base.candles, live.candle],
      }
    : base;
  return {
    data,
    connection: !enabled ? "paused" : !supported ? "periodic" : connection,
    lastUpdate: valid ? live.receivedAt : null,
  };
}
