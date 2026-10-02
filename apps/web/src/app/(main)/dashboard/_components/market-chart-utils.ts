import type { MarketCandle } from "@marketpilot/market-data";
import type { UTCTimestamp } from "lightweight-charts";

export const chartTime = (time: string) => Math.floor(Date.parse(time) / 1000) as UTCTimestamp;
export const chartDate = (time: string | number) =>
  new Date(typeof time === "number" ? time * 1000 : time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const pricePrecision = (price: number) => (price < 1 ? 6 : price < 10 ? 5 : 2);
export const chartPrice = (price: number) =>
  price.toLocaleString(undefined, { maximumFractionDigits: pricePrecision(price) });

/** Interpolate time coordinates between actual observations, without inventing a candle. */
export function timePosition(candles: MarketCandle[], timestamp: number): number | null {
  if (!candles.length || timestamp < Date.parse(candles[0].time) || timestamp > Date.parse(candles.at(-1)!.time))
    return null;
  const next = candles.findIndex((candle) => Date.parse(candle.time) >= timestamp);
  if (next <= 0) return 0;
  const before = Date.parse(candles[next - 1].time);
  const after = Date.parse(candles[next].time);
  return next - 1 + (timestamp - before) / (after - before);
}

/** Canvas libraries require RGB; resolve the existing theme token through the browser. */
export function canvasColor(element: HTMLElement, token: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return "transparent";
  context.fillStyle = getComputedStyle(element).getPropertyValue(token).trim();
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
}
