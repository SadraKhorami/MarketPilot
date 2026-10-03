import { AIError, type AIProvider, type StreamEvent } from "@marketpilot/ai";
import { AiService } from "./ai.service";

const runId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const conversationId = "00000000-0000-4000-8000-000000000003";
const input = { requestId, conversationId, input: "Explain RSI" };
function setup() {
  let saved: Record<string, unknown> | null = null;
  const release = jest.fn().mockResolvedValue(undefined);
  const db = {
    journalEntry: { findUnique: jest.fn().mockResolvedValue(null) },
    aiRun: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockImplementation(async () => saved),
      create: jest.fn().mockImplementation(async ({ data }) => {
        saved = { ...data, id: runId, proposals: [] };
        return saved;
      }),
      update: jest.fn().mockImplementation(async ({ data }) => {
        saved = { ...saved, ...data };
        return saved;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const budget = { acquire: jest.fn().mockResolvedValue(release) };
  const tools = { execute: jest.fn() };
  const proposals = { propose: jest.fn() };
  const provider: AIProvider = {
    model: "test/research",
    check: jest.fn().mockResolvedValue({ reservationUsd: 0.01 }),
    complete: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        interpretation: [{ text: "RSI describes relative momentum. Sentiment scoring is unavailable.", sourceIds: [] }],
      }),
      calls: [],
      inputTokens: 12,
      outputTokens: 8,
      cost: 0.001,
    }),
  };
  const service = new AiService(
    db as never,
    tools as never,
    budget as never,
    proposals as never,
    provider,
    {
      consumeIn: jest.fn(),
      locked: (_id: string, action: (tx: typeof db) => unknown) => action(db),
    } as never,
    {
      resolve: async (_userId: string, fallback: AIProvider | null) => ({
        provider: fallback,
        personal: false,
        preferences: { language: "auto", memory: "" },
      }),
    } as never,
  );
  return { service, db, budget, release, tools, proposals, provider };
}
describe("AI research lifecycle", () => {
  it("completes a bounded run, records only operational metadata and replays results without provider spend", async () => {
    const { service, db, provider, release } = setup();
    const events: StreamEvent[] = [];
    await service.research("owner", input, new AbortController().signal, (event) => events.push(event));
    expect(events.at(-1)?.type).toBe("result");
    expect(release).toHaveBeenCalledTimes(1);
    expect(db.aiRun.update).toHaveBeenCalledWith({
      where: { id: runId },
      data: expect.objectContaining({ status: "completed", inputTokens: 24, outputTokens: 16, costUsd: 0.002 }),
    });
    await service.research("owner", input, new AbortController().signal, (event) => events.push(event));
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(db.aiRun.findUnique).toHaveBeenCalledWith({
      where: { userId_requestId: { userId: "owner", requestId } },
      include: { proposals: true },
    });
    expect(db.aiRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "owner", conversationId, status: "completed" }),
        take: 2,
      }),
    );
  });
  it("rejects tampered request replay", async () => {
    const { service, provider } = setup();
    await service.research("owner", input, new AbortController().signal, () => undefined);
    await expect(
      service.research(
        "owner",
        { ...input, input: "A different request" },
        new AbortController().signal,
        () => undefined,
      ),
    ).rejects.toMatchObject({ code: "AI_REQUEST_CONFLICT" });
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });
  it("records failure safely, releases admission, and cannot resume failed turns with the same request ID", async () => {
    const { service, provider, release, db } = setup();
    provider.complete = jest.fn().mockRejectedValue(new Error("raw-secret-provider-payload"));
    await expect(service.research("owner", input, new AbortController().signal, () => undefined)).rejects.toMatchObject(
      { code: "AI_RESEARCH_FAILED" },
    );
    expect(db.aiRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", errorCode: "AI_RESEARCH_FAILED" }) }),
    );
    expect(JSON.stringify(db.aiRun.update.mock.calls)).not.toContain("raw-secret");
    expect(release).toHaveBeenCalledTimes(1);
    await expect(service.research("owner", input, new AbortController().signal, () => undefined)).rejects.toMatchObject(
      { code: "AI_REQUEST_FINISHED" },
    );
  });
  it("marks cancelled/timed-out runs and cancels before domain tool execution", async () => {
    for (const timeout of [false, true]) {
      const { service, db, provider, release, tools } = setup();
      const abort = new AbortController();
      provider.complete = jest.fn().mockImplementation(async () => {
        abort.abort(timeout ? new DOMException("deadline", "TimeoutError") : undefined);
        throw new Error("aborted");
      });
      await expect(service.research("owner", input, abort.signal, () => undefined)).rejects.toMatchObject({
        code: timeout ? "AI_TIMEOUT" : "AI_CANCELLED",
      });
      expect(db.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
      );
      expect(tools.execute).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledTimes(1);
    }
  });
  it("fails closed when provider is missing or admission exceeds limits", async () => {
    const { db, tools, budget, proposals } = setup();
    const missing = new AiService(
      db as never,
      tools as never,
      budget as never,
      proposals as never,
      null,
      {} as never,
      { resolve: async () => ({ provider: null, personal: false }) } as never,
    );
    await expect(missing.research("owner", input, new AbortController().signal, () => undefined)).rejects.toMatchObject(
      { code: "AI_NOT_CONFIGURED" },
    );
    expect(budget.acquire).not.toHaveBeenCalled();
    const full = setup();
    full.budget.acquire.mockRejectedValue(new AIError("AI_BUSY", "Busy"));
    await expect(
      full.service.research("owner", input, new AbortController().signal, () => undefined),
    ).rejects.toMatchObject({ code: "AI_BUSY" });
    expect(full.provider.complete).not.toHaveBeenCalled();
  });
  it("returns only owned bounded history and refreshes confirmation state from server records", async () => {
    const { service, db } = setup();
    await service.history("owner", conversationId);
    expect(db.aiRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "owner", conversationId }), take: 20 }),
    );
  });
});
