import { z } from "zod";
export const AiPreferencesSchema = z
  .object({
    language: z.enum(["auto", "fa", "en"]).default("auto"),
    memory: z.string().trim().max(1200).default(""),
    source: z.enum(["platform", "personal"]).default("platform"),
    modelId: z.string().max(200).nullable().default(null),
    requestBudget: z.number().finite().min(0.01).max(100).default(1),
  })
  .strict();
export type AiPreferences = z.infer<typeof AiPreferencesSchema>;
export type AiSettingsView = AiPreferences & {
  hasKey: boolean;
  keyLast4: string | null;
  credentialStorageReady: boolean;
};
export type AiModelRecord = {
  id: string;
  name: string;
  contextLength: number;
  promptPrice: number;
  completionPrice: number;
  requestPrice: number;
  compatible: boolean;
  syncedAt: string;
};
export type ConversationRecord = {
  conversationId: string;
  title: string;
  updatedAt: string;
  turnCount: number;
  archived: boolean;
};
