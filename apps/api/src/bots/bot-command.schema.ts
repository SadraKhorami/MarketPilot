import { z } from "zod";
export const CommandPayloadSchema = z.object({
  identity: z.string().regex(/^\d{1,20}$/),
  name: z.string().max(120),
  command: z.enum(["start", "help", "link", "price", "market", "analyze", "ask", "watchlist", "alerts"]),
  argument: z.string().max(2000),
  replyToken: z.string().max(500).optional(),
});
export type CommandPayload = z.infer<typeof CommandPayloadSchema>;
export const TelegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z
    .object({
      date: z.number().int(),
      text: z.string().max(4096).optional(),
      from: z
        .object({
          id: z.number().int().positive(),
          is_bot: z.boolean(),
          first_name: z.string(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({ id: z.number().int(), type: z.string() }),
    })
    .optional(),
});
export const DiscordInteractionSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  application_id: z.string(),
  guild_id: z.string().optional(),
  type: z.number().int(),
  token: z.string().min(1).max(500),
  user: z.object({ id: z.string().regex(/^\d{17,20}$/), username: z.string(), bot: z.boolean().optional() }).optional(),
  member: z
    .object({
      user: z.object({ id: z.string().regex(/^\d{17,20}$/), username: z.string(), bot: z.boolean().optional() }),
    })
    .optional(),
  data: z
    .object({
      name: z.string(),
      options: z
        .array(z.object({ name: z.string(), type: z.number(), value: z.union([z.string(), z.number()]) }))
        .max(1)
        .optional(),
    })
    .optional(),
});
