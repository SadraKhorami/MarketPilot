import { z } from "zod";
import {
  type AICompletion,
  AIError,
  type AIMessage,
  type AIProvider,
  AnswerSchema,
  toolDefinitions,
} from "./contracts";

const callSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.literal("function"),
  function: z.object({
    name: z.string().max(80),
    arguments: z.string().max(2000),
  }),
});
const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable(),
        message: z.object({
          content: z.string().max(8000).nullable().optional(),
          tool_calls: z.array(callSchema).max(8).optional(),
        }),
      }),
    )
    .min(1)
    .max(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    cost: z.number().nonnegative().finite().optional(),
  }),
});
const modelSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      supported_parameters: z.array(z.string()),
      pricing: z.object({
        prompt: z.string(),
        completion: z.string(),
        request: z.string().optional(),
      }),
    }),
  ),
});
export class OpenRouterProvider implements AIProvider {
  private discovery: Promise<{ until: number; reservationUsd: number }> | null = null;
  private checked: { until: number; reservationUsd: number } | null = null;
  constructor(
    readonly model: string,
    private readonly key: string,
    private readonly baseUrl = "https://openrouter.ai/api/v1",
    private readonly fetcher: typeof fetch = fetch,
    private readonly maxReservationUsd = 0.25,
  ) {
    if (baseUrl !== "https://openrouter.ai/api/v1")
      throw new AIError("AI_CONFIG_INVALID", "The configured OpenRouter URL is unsupported.");
    if (!model || !key)
      throw new AIError("AI_NOT_CONFIGURED", "AI research needs a configured provider key and model.");
  }
  async check(signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.checked && this.checked.until > Date.now()) return this.checked;
    // Share one bounded catalog read across concurrent callers. One user's cancellation cannot cancel another's discovery.
    if (!this.discovery) {
      this.discovery = this.discover(AbortSignal.timeout(30_000)).then(
        (result) => {
          this.discovery = null;
          return result;
        },
        (error: unknown) => {
          this.discovery = null;
          throw error;
        },
      );
    }
    const pending = this.discovery;
    let cancel: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        cancel = () => reject(new AIError("AI_CANCELLED", "Research was cancelled."));
        signal.addEventListener("abort", cancel, { once: true });
      });
      return await Promise.race([pending, aborted]);
    } finally {
      if (cancel) signal.removeEventListener("abort", cancel);
    }
  }
  private async discover(signal: AbortSignal) {
    const body = modelSchema.safeParse(await this.request("/models", null, signal));
    const model = body.success ? body.data.data.find((m) => m.id === this.model) : undefined;
    if (
      !model ||
      !["tools", "tool_choice", "structured_outputs"].every((p) => model.supported_parameters.includes(p))
    ) {
      throw new AIError("AI_MODEL_UNSUPPORTED", "The configured model must support tools and structured outputs.");
    }
    const prices = [model.pricing.prompt, model.pricing.completion, model.pricing.request ?? "0"].map(Number);
    if (prices.some((p) => !Number.isFinite(p) || p < 0))
      throw new AIError("AI_PRICING_UNAVAILABLE", "Provider pricing could not be validated.");
    // Four tool rounds and up to two final responses, each bounded to 24 KB (at most 24K input tokens), 1,200 output tokens.
    const reservationUsd = 6 * (24_000 * prices[0] + 1200 * prices[1] + prices[2]);
    if (reservationUsd > this.maxReservationUsd)
      throw new AIError(
        "AI_MODEL_BUDGET",
        "This model exceeds the selected request budget. Choose a less expensive model or adjust your personal-key budget.",
      );
    this.checked = { until: Date.now() + 300_000, reservationUsd };
    return this.checked;
  }
  async complete(
    messages: AIMessage[],
    allowAlert: boolean,
    final: boolean,
    signal: AbortSignal,
    allowTrade = false,
    responseSchema?: { name: string; schema: Record<string, unknown> },
  ): Promise<AICompletion> {
    const body = {
      model: this.model,
      messages,
      tools: toolDefinitions(allowAlert, allowTrade),
      tool_choice: final ? "none" : "auto",
      max_tokens: responseSchema ? 3000 : 1200,
      stream: false,
      provider: {
        require_parameters: true,
        allow_fallbacks: false,
        data_collection: "deny",
      },
      ...(final
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: responseSchema?.name ?? "market_research",
                strict: true,
                schema: responseSchema?.schema ?? z.toJSONSchema(AnswerSchema),
              },
            },
          }
        : {}),
    };
    if (new TextEncoder().encode(JSON.stringify(body)).length > 24_000)
      throw new AIError("AI_CONTEXT_LIMIT", "Research context is too large. Start a new research question.");
    const parsed = completionSchema.safeParse(await this.request("/chat/completions", body, signal));
    if (!parsed.success)
      throw new AIError("AI_INVALID_RESPONSE", "The provider returned an invalid research response.");
    const choice = parsed.data.choices[0];
    if (!["stop", "tool_calls"].includes(choice.finish_reason ?? ""))
      throw new AIError("AI_INCOMPLETE_RESPONSE", "The provider could not complete the research response.");
    return {
      content: choice.message.content ?? null,
      calls: choice.message.tool_calls ?? [],
      inputTokens: parsed.data.usage.prompt_tokens,
      outputTokens: parsed.data.usage.completion_tokens,
      cost: parsed.data.usage.cost ?? null,
    };
  }
  private async request(path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    try {
      signal.throwIfAborted();
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "X-Title": "MarketPilot",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        redirect: "error",
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new AIError(
          response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_UNAVAILABLE",
          response.status === 429
            ? "The AI provider is busy. Try again shortly."
            : "The AI provider is unavailable. Check provider configuration or credits.",
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new AIError("AI_EMPTY_RESPONSE", "The provider returned no response.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > (path === "/models" ? 4_000_000 : 64_000)) {
          await reader.cancel();
          throw new AIError("AI_RESPONSE_LIMIT", "The provider response exceeded the size limit.");
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      if (error instanceof AIError) throw error;
      if (signal.aborted) {
        if (signal.reason?.name === "TimeoutError")
          throw new AIError("AI_TIMEOUT", "Research timed out. Try a narrower question.");
        throw new AIError("AI_CANCELLED", "Research was cancelled.");
      }
      if (error instanceof Error && /Timeout|Abort/.test(error.name))
        throw new AIError("AI_TIMEOUT", "Research timed out. Try a narrower question.");
      throw new AIError("AI_PROVIDER_UNAVAILABLE", "The AI provider could not return a valid response.");
    }
  }
}
