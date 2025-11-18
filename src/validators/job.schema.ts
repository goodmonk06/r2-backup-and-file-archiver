import { z } from 'zod';

export const createJobSchema = z.object({
  name: z.string().min(1).max(100),
  source: z.string().min(1),
  bucket: z.string().min(1),
  prefix: z.string().default(''),
  schedule: z.string().regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-7])|\*\/([0-7]))$/, {
    message: 'Invalid cron expression',
  }),
  exclude: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

export const updateJobSchema = z.object({
  source: z.string().min(1).optional(),
  bucket: z.string().min(1).optional(),
  prefix: z.string().optional(),
  schedule: z.string().regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-7])|\*\/([0-7]))$/, {
    message: 'Invalid cron expression',
  }).optional(),
  exclude: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
