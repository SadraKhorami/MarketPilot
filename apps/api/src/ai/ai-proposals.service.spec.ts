import { AiProposalsService } from "./ai-proposals.service";

const runId = "00000000-0000-4000-8000-000000000001";
const id = "00000000-0000-4000-8000-000000000002";
function setup(state = "pending", expiresAt = new Date(Date.now() + 600_000)) {
  let record = {
    id,
    runId,
    symbol: "BTC-USD",
    condition: "PRICE_ABOVE",
    threshold: { toString: () => "150" },
    state,
    alertId: state === "confirmed" ? "00000000-0000-4000-8000-000000000003" : null,
    expiresAt,
  };
  const proposal = {
    findFirst: jest.fn().mockImplementation(async () => record),
    updateMany: jest.fn().mockImplementation(async ({ data }) => {
      if (record.state !== "pending") return { count: 0 };
      record = { ...record, ...data };
      return { count: 1 };
    }),
    update: jest.fn().mockImplementation(async ({ data }) => {
      record = { ...record, ...data };
      return record;
    }),
  };
  const tx = { aiAlertProposal: proposal };
  const db = { $transaction: jest.fn().mockImplementation(async (fn) => fn(tx)) };
  const alerts = { create: jest.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000003" }) };
  const service = new AiProposalsService(db as never, alerts as never);
  return { service, tx, db, proposal, alerts };
}
describe("AI alert proposal confirmation", () => {
  it("uses bound user/run/server terms and the existing alert audit service in one transaction", async () => {
    const { service, proposal, alerts, tx } = setup();
    const result = await service.decide("owner", id, { runId, decision: "confirm" });
    expect(proposal.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id,
        runId,
        run: expect.objectContaining({ userId: "owner", status: "completed" }),
      }),
    });
    expect(alerts.create).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({ assetId: "BTC-USD", condition: "PRICE_ABOVE", threshold: 150 }),
      tx,
    );
    expect(result.state).toBe("confirmed");
    expect(result.alertId).not.toBeNull();
    await service.decide("owner", id, { runId, decision: "confirm" });
    expect(alerts.create).toHaveBeenCalledTimes(1);
  });
  it("rejects expired, foreign, failed-run and tampered-bound proposals before any mutation", async () => {
    const expired = setup("pending", new Date(Date.now() - 1));
    await expect(expired.service.decide("owner", id, { runId, decision: "confirm" })).rejects.toThrow(/expired/);
    expect(expired.alerts.create).not.toHaveBeenCalled();
    const foreign = setup();
    foreign.proposal.findFirst.mockResolvedValue(null);
    await expect(foreign.service.decide("other", id, { runId: "wrong-run", decision: "confirm" })).rejects.toThrow(
      /unavailable/,
    );
    expect(foreign.alerts.create).not.toHaveBeenCalled();
  });
  it("cancels idempotently, forbids later confirmation and handles concurrent confirmation replay", async () => {
    const cancelled = setup();
    await cancelled.service.decide("owner", id, { runId, decision: "cancel" });
    await cancelled.service.decide("owner", id, { runId, decision: "cancel" });
    expect(cancelled.alerts.create).not.toHaveBeenCalled();
    await expect(cancelled.service.decide("owner", id, { runId, decision: "confirm" })).rejects.toThrow(/resolved/);
    const concurrent = setup();
    const results = await Promise.all([
      concurrent.service.decide("owner", id, { runId, decision: "confirm" }),
      concurrent.service.decide("owner", id, { runId, decision: "confirm" }),
    ]);
    expect(concurrent.alerts.create).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.state === "confirmed")).toBe(true);
  });
  it("revalidates stored condition and threshold before confirmation", async () => {
    const { service, proposal, alerts } = setup();
    proposal.findFirst.mockResolvedValue({
      id,
      runId,
      symbol: "BTC-USD",
      condition: "RSI_ABOVE",
      threshold: 999,
      state: "pending",
      expiresAt: new Date(Date.now() + 1000),
      alertId: null,
    } as never);
    await expect(service.decide("owner", id, { runId, decision: "confirm" })).rejects.toThrow();
    expect(alerts.create).not.toHaveBeenCalled();
  });
});
