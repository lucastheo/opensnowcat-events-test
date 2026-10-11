import { z } from 'zod';

export const CalcRequestSchema = z.object({
  a: z.number({ required_error: "'a' is required and must be a number" }),
  b: z.number({ required_error: "'b' is required and must be a number" }),
  operator: z.enum(['+', '-', '*', '/'], {
    errorMap: () => ({ message: "Operator must be one of: '+', '-', '*', '/'" })
  })
});
export type CalcRequestBody = z.infer<typeof CalcRequestSchema>;

export const CalcResponseSchema = z.object({
  result: z.number()
});
export type CalcResponseBody = z.infer<typeof CalcResponseSchema>;
