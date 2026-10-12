import { z } from 'zod';

export const DailyExcuseResponseSchema = z.object({
  id: z.number(),
  excuse: z.string()
});
export type DailyExcuseResponseBody = z.infer<typeof DailyExcuseResponseSchema>;
