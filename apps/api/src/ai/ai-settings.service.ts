import { AIError, type AIProvider, AiPreferencesSchema, OpenRouterProvider } from "@marketpilot/ai";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { DatabaseService } from "../database.module";
import { credentialStorageReady, openCredential, sealCredential } from "./ai-credentials";
import { AiModelsService } from "./ai-models.service";
const updateSchema = AiPreferencesSchema.partial()
  .extend({
    apiKey: z
      .string()
      .trim()
      .min(20)
      .max(256)
      .regex(/^sk-or-[a-zA-Z\d_-]+$/)
      .optional(),
    removeKey: z.boolean().optional(),
  })
  .strict();
@Injectable()
export class AiSettingsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly models: AiModelsService,
  ) {}
  async view(userId: string) {
    const saved = await this.db.aiSettings.findUnique({ where: { userId } });
    return {
      ...AiPreferencesSchema.parse(
        saved
          ? {
              language: saved.language,
              memory: saved.memory,
              source: saved.source,
              modelId: saved.modelId,
              requestBudget: saved.requestBudget,
            }
          : {},
      ),
      hasKey: !!saved?.encryptedKey,
      keyLast4: saved?.keyLast4 ?? null,
      credentialStorageReady: credentialStorageReady(),
    };
  }
  async update(userId: string, body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new AIError("AI_INPUT_SETTINGS", "Check the settings fields and personal key.");
    const { apiKey, removeKey, ...preferences } = parsed.data;
    if (apiKey && removeKey) throw new AIError("AI_INPUT_SETTINGS", "Connect or remove a key in separate actions.");
    const current = await this.db.aiSettings.findUnique({ where: { userId } });
    const source = removeKey ? "platform" : (preferences.source ?? current?.source ?? "platform");
    const modelId = preferences.modelId === undefined ? current?.modelId : preferences.modelId;
    if (source === "personal") {
      if (!credentialStorageReady())
        throw new AIError("AI_KEY_STORAGE_UNAVAILABLE", "Personal key storage is not configured.");
      if (!apiKey && !current?.encryptedKey) throw new AIError("AI_INPUT_KEY", "Connect your OpenRouter key first.");
      if (!modelId) throw new AIError("AI_INPUT_MODEL", "Choose a model for your personal key.");
      const model = await this.models.requireCompatible(modelId);
      const estimate = 6 * (24_000 * model.promptPrice + 1200 * model.completionPrice + model.requestPrice);
      if (estimate > (preferences.requestBudget ?? current?.requestBudget ?? 1))
        throw new AIError(
          "AI_INPUT_ESTIMATE",
          `This model needs a conservative request budget of at least $${estimate.toFixed(4)}. Increase your limit or choose a less expensive model.`,
        );
    }
    if (apiKey) {
      if (!credentialStorageReady())
        throw new AIError("AI_KEY_STORAGE_UNAVAILABLE", "Personal key storage is not configured.");
      try {
        const response = await fetch("https://openrouter.ai/api/v1/key", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("invalid key");
        const verified = z
          .object({ data: z.object({ is_management_key: z.boolean().optional() }) })
          .parse(await response.json());
        if (verified.data.is_management_key) throw new Error("management key");
      } catch {
        throw new AIError(
          "AI_INPUT_KEY",
          "OpenRouter could not verify this inference key. Check the key and try again.",
        );
      }
    }
    const data = {
      ...preferences,
      source,
      ...(apiKey ? { encryptedKey: sealCredential(userId, apiKey), keyLast4: apiKey.slice(-4) } : {}),
      ...(removeKey ? { encryptedKey: null, keyLast4: null, modelId: null } : {}),
    };
    await this.db.aiSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return this.view(userId);
  }
  async resolve(userId: string, fallback: AIProvider | null) {
    const settings = await this.db.aiSettings.findUnique({ where: { userId } });
    const personal = settings?.source === "personal";
    if (!personal) return { provider: fallback, personal: false, preferences: await this.view(userId) };
    if (!settings.encryptedKey || !settings.modelId)
      throw new AIError("AI_KEY_UNAVAILABLE", "Reconnect your key and select a model in AI settings.");
    await this.models.requireCompatible(settings.modelId);
    return {
      provider: new OpenRouterProvider(
        settings.modelId,
        openCredential(userId, settings.encryptedKey),
        undefined,
        undefined,
        settings.requestBudget,
      ),
      personal: true,
      preferences: await this.view(userId),
    };
  }
}
