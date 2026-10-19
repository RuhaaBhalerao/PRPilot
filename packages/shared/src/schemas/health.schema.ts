import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('prpilot-api'),
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
