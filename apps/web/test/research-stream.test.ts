import { streamResearch } from "../src/app/(main)/dashboard/ai-analyst/_components/research-stream";
import assert from "node:assert/strict";
import { test } from "node:test";

const request = {
  requestId: "00000000-0000-4000-8000-000000000001",
  conversationId: "00000000-0000-4000-8000-000000000002",
  input: "Analyze BTC",
};
const signal = new AbortController().signal;
function chunks(parts: Uint8Array[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
const encoder = new TextEncoder();
const terminal = 'data: {"type":"error","code":"AI_PROVIDER_UNAVAILABLE","message":"Provider unavailable"}\n\n';
test("parses split UTF-8/multiline/CRLF progress and one terminal frame without duplicating turns", async () => {
  const original = globalThis.fetch;
  const frame = encoder.encode(
    `: heartbeat\r\n\r\ndata: {"type":"progress",\r\ndata: "message":"در حال بررسی"}\r\n\r\n${terminal}`,
  );
  globalThis.fetch = async () => chunks(Array.from(frame, (byte) => Uint8Array.of(byte)));
  try {
    const events: string[] = [];
    await streamResearch(request, signal, (event) => events.push(event.type));
    assert.deepEqual(events, ["progress", "error"]);
  } finally {
    globalThis.fetch = original;
  }
});
test("handles malformed/unknown, truncated and duplicate terminal streams as failures", async () => {
  const original = globalThis.fetch;
  try {
    for (const frame of [
      "data: {broken}\n\n",
      'data: {"type":"execute","url":"https://evil.test"}\n\n',
      ": pending\n\n",
      terminal + terminal,
    ]) {
      globalThis.fetch = async () => chunks([encoder.encode(frame)]);
      await assert.rejects(streamResearch(request, signal, () => undefined));
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("returns safe REST failure and respects cancellation without leaving the reader active", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ error: { code: "AI_NOT_CONFIGURED", message: "Provider not configured" } }, { status: 503 });
    await assert.rejects(
      streamResearch(request, signal, () => undefined),
      /not configured/,
    );
    const abort = new AbortController();
    abort.abort();
    globalThis.fetch = async (_url, options) => {
      options?.signal?.throwIfAborted();
      return chunks([]);
    };
    await assert.rejects(
      streamResearch(request, abort.signal, () => undefined),
      /aborted/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
