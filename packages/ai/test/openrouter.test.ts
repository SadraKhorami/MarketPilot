import assert from "node:assert/strict";
import { test } from "node:test";
import { AIError } from "../src/contracts";
import { OpenRouterProvider } from "../src/openrouter";

const signal = new AbortController().signal;
const catalog = (parameters = ["tools", "tool_choice", "structured_outputs"], price = "0.000001") => ({
  data: [
    {
      id: "test/research",
      supported_parameters: parameters,
      pricing: { prompt: price, completion: price, request: "0" },
    },
  ],
});
const response = {
  choices: [
    {
      finish_reason: "stop",
      message: {
        content: '{"interpretation":[{"text":"Explains momentum","sourceIds":[]}]}',
      },
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 10, cost: 0.001 },
};
test("uses explicit configured model, capability discovery, strict structured response and bounded output", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  const provider = new OpenRouterProvider("test/research", "test-only-key", undefined, async (url, options) => {
    requests.push({
      url: String(url),
      body: options?.body ? JSON.parse(String(options.body)) : null,
    });
    return Response.json(String(url).endsWith("/models") ? catalog() : response);
  });
  const check = await provider.check(signal);
  assert.ok(check.reservationUsd < 0.25);
  await provider.complete([{ role: "user", content: "Explain RSI" }], false, true, signal);
  assert.equal(requests[0].url, "https://openrouter.ai/api/v1/models");
  assert.equal(requests[1].body?.model, "test/research");
  assert.equal(requests[1].body?.stream, false);
  assert.deepEqual(requests[1].body?.provider, {
    require_parameters: true,
    allow_fallbacks: false,
    data_collection: "deny",
  });
  assert.equal(requests[1].body?.max_tokens, 1200);
  assert.equal(requests[1].body?.tool_choice, "none");
});
test("routes with strict parameters without requiring optional parallel tool-call support", async () => {
  const provider = new OpenRouterProvider("test/research", "test-only-key", undefined, async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    if (Object.hasOwn(body, "parallel_tool_calls")) return Response.json({ error: { code: 404 } }, { status: 404 });
    assert.equal(body.provider.require_parameters, true);
    assert.equal(body.tool_choice, "auto");
    assert.ok(body.tools.length > 0);
    return Response.json(response);
  });
  const result = await provider.complete([{ role: "user", content: "Explain momentum" }], false, false, signal);
  assert.equal(result.outputTokens, 10);
});
test("missing configuration, unsupported model/capabilities and expensive models fail closed", async () => {
  assert.throws(() => new OpenRouterProvider("", ""), /configured/);
  assert.throws(() => new OpenRouterProvider("test/research", "test-only-key", "https://evil.test"), /unsupported/);
  for (const metadata of [catalog([]), catalog(["tools", "tool_choice", "structured_outputs"], "1"), { data: [] }]) {
    await assert.rejects(
      new OpenRouterProvider("test/research", "test-only-key", undefined, async () => Response.json(metadata)).check(
        signal,
      ),
    );
  }
});
test("handles safe 429, failed status, malformed results, no content and mid-response error without exposing provider text", async () => {
  for (const status of [401, 402, 429, 503]) {
    const provider = new OpenRouterProvider("test/research", "test-only-key", undefined, async () =>
      Response.json({ error: { message: "sensitive-upstream-detail" } }, { status }),
    );
    await assert.rejects(
      provider.complete([], false, false, signal),
      (error: unknown) =>
        error instanceof AIError &&
        !error.message.includes("sensitive") &&
        (status !== 429 || error.code === "AI_RATE_LIMITED"),
    );
  }
  for (const body of [
    {},
    { error: { code: 502, message: "secret-detail" } },
    { ...response, choices: [] },
    {
      ...response,
      choices: [{ finish_reason: "length", message: { content: "" } }],
    },
  ]) {
    await assert.rejects(
      new OpenRouterProvider("test/research", "test-only-key", undefined, async () => Response.json(body)).complete(
        [],
        false,
        false,
        signal,
      ),
    );
  }
});
test("aborted calls, timeout, large provider output and context size are bounded", async () => {
  const abort = new AbortController();
  abort.abort();
  const provider = new OpenRouterProvider("test/research", "test-only-key", undefined, async () =>
    Response.json(response),
  );
  await assert.rejects(provider.complete([], false, false, abort.signal), /cancelled/);
  await assert.rejects(
    provider.complete([{ role: "user", content: "x".repeat(25000) }], false, false, signal),
    /too large/,
  );
  await assert.rejects(
    new OpenRouterProvider("test/research", "test-only-key", undefined, async () => {
      throw new DOMException("timeout", "TimeoutError");
    }).complete([], false, false, signal),
    /timed out/,
  );
  await assert.rejects(
    new OpenRouterProvider(
      "test/research",
      "test-only-key",
      undefined,
      async () => new Response("x".repeat(64001)),
    ).complete([], false, false, signal),
    /size limit/,
  );
});

test("shares catalog discovery and isolates cancellation before spend admission", async () => {
  let requests = 0;
  let finish: (response: Response) => void = () => undefined;
  const provider = new OpenRouterProvider("test/research", "test-only-key", undefined, async () => {
    requests++;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  const abort = new AbortController();
  const cancelled = provider.check(abort.signal);
  const second = provider.check(signal);
  abort.abort();
  await assert.rejects(cancelled, /cancelled/);
  finish(Response.json(catalog()));
  assert.ok((await second).reservationUsd < 0.25);
  assert.equal(requests, 1);
  await provider.check(signal);
  assert.equal(requests, 1);
});
