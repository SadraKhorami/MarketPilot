import { type StreamEvent, StreamEventSchema, type TradeContext } from "@marketpilot/ai/contracts";

import { ApiError } from "@/lib/api/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export async function streamResearch(
  input: {
    requestId: string;
    conversationId: string;
    input: string;
    watchlistId?: string;
    tradeContext?: TradeContext;
  },
  signal: AbortSignal,
  receive: (event: StreamEvent) => void,
) {
  const response = await fetch(`${API_BASE}/ai/research`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("marketpilot:session-expired"));
    const error = await response.json().catch(() => null);
    throw new ApiError(error?.error?.message ?? "Research could not be started.", response.status, error?.error?.code);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The research connection returned no data.");
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw new Error("The research response was too large.");
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) {
          let event: StreamEvent;
          try {
            event = StreamEventSchema.parse(JSON.parse(data));
          } catch {
            throw new Error("The research response could not be validated. Recover its result before retrying.");
          }
          if (terminal) throw new Error("The research stream returned duplicate terminal data.");
          receive(event);
          if (event.type === "error" || event.type === "result") terminal = true;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (!terminal) throw new Error("The research connection ended early. Recover the result before retrying.");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export const toolLabels = {
  getMarketPrice: "Price observation",
  getTechnicalIndicators: "Technical indicators",
  getTrendAnalysis: "Trend and price levels",
  getMarketNews: "Stored news coverage",
  getWatchlist: "Your watchlist",
  compareAssets: "Asset comparison",
  createAlert: "Alert proposal",
  getTradeSetup: "Conditional entry scenario",
} satisfies Record<string, string>;
