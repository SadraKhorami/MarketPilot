import { AIError } from "@marketpilot/ai";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import { pageResult, type PageQueryDto } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
const price = z.coerce.number().finite();
const catalog = z.object({
  data: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        name: z.string().min(1).max(300),
        context_length: z.number().int().nonnegative(),
        supported_parameters: z.array(z.string()),
        architecture: z.object({ input_modalities: z.array(z.string()), output_modalities: z.array(z.string()) }),
        pricing: z.object({ prompt: price, completion: price, request: price.optional().default(0) }),
      }),
    )
    .min(1)
    .max(10000),
});
@Injectable()
export class AiModelsService implements OnModuleInit {
  private syncing: Promise<void> | null = null;
  constructor(private readonly db: DatabaseService) {}
  onModuleInit() {
    void this.ensureFresh().catch(() => undefined);
  }
  async ensureFresh() {
    const latest = await this.db.aiModel.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } });
    if (latest && latest.syncedAt.getTime() > Date.now() - 6 * 3600_000) return;
    if (!this.syncing)
      this.syncing = this.sync().finally(() => {
        this.syncing = null;
      });
    return this.syncing;
  }
  private async sync() {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error("catalog unavailable");
      const models = catalog.parse(await response.json()).data;
      const syncedAt = new Date();
      await this.db.$transaction(
        async (tx) => {
          for (const model of models) {
            const data = {
              name: model.name,
              contextLength: model.context_length,
              supportedParameters: model.supported_parameters,
              promptPrice: model.pricing.prompt,
              completionPrice: model.pricing.completion,
              requestPrice: model.pricing.request,
              compatible:
                [model.pricing.prompt, model.pricing.completion, model.pricing.request].every((price) => price >= 0) &&
                ["tools", "tool_choice", "structured_outputs"].every((p) => model.supported_parameters.includes(p)) &&
                model.architecture.input_modalities.includes("text") &&
                model.architecture.output_modalities.includes("text"),
              active: true,
              syncedAt,
            };
            await tx.aiModel.upsert({ where: { id: model.id }, create: { id: model.id, ...data }, update: data });
          }
          await tx.aiModel.updateMany({ where: { syncedAt: { lt: syncedAt } }, data: { active: false } });
        },
        { timeout: 60000 },
      );
    } catch {
      throw new AIError("AI_CATALOG_UNAVAILABLE", "The model catalog could not be refreshed. Try again shortly.");
    }
  }
  async list(query: PageQueryDto) {
    let refreshFailed = false;
    await this.ensureFresh().catch(() => {
      refreshFailed = true;
    });
    const where = {
      active: true,
      ...(query.search
        ? {
            OR: [
              { id: { contains: query.search, mode: "insensitive" as const } },
              { name: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.aiModel.findMany({
        where,
        orderBy: [{ compatible: "desc" }, { name: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.aiModel.count({ where }),
    ]);
    if (!total && refreshFailed)
      throw new AIError("AI_CATALOG_UNAVAILABLE", "Models are unavailable. Try again shortly.");
    return { ...pageResult(items, total, query), refreshFailed };
  }
  async requireCompatible(id: string) {
    await this.ensureFresh();
    const model = await this.db.aiModel.findUnique({ where: { id } });
    if (!model?.active || !model.compatible)
      throw new AIError("AI_INPUT_MODEL", "Choose an available model supporting tools and structured answers.");
    return model;
  }
}
