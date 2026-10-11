import { z } from 'zod';

export const DiceRequestSchema = z.object({
  count: z.number().int().min(1).max(10).default(2),
  sides: z.enum(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']).default('d6')
});
export type DiceRequestBody = z.infer<typeof DiceRequestSchema>;

export const DiceResponseSchema = z.object({
  rolls: z.array(z.number()),
  total: z.number()
});
export type DiceResponseBody = z.infer<typeof DiceResponseSchema>;
