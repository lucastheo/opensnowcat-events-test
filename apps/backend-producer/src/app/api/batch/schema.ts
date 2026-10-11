import { z } from 'zod';

export const BatchRequestSchema = z.object({
  count: z.number().int().min(1).max(1000).default(50)
});
export type BatchRequestBody = z.infer<typeof BatchRequestSchema>;

export const BatchResponseSchema = z.object({
  status: z.literal('completed'),
  events_emitted: z.number()
});
export type BatchResponseBody = z.infer<typeof BatchResponseSchema>;
