import { z } from 'zod';

export const TimestampRequestSchema = z.object({
  timezone: z.string().default('UTC')
});
export type TimestampRequestBody = z.infer<typeof TimestampRequestSchema>;

export const TimestampResponseSchema = z.object({
  timestamp_iso: z.string(),
  formatted_local: z.string(),
  timezone: z.string()
});
export type TimestampResponseBody = z.infer<typeof TimestampResponseSchema>;
