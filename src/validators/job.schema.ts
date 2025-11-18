import { z } from 'zod';

export const createJobSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  source: z.string().min(1),
  bucket: z.string().min(1),
  prefix: z.string().default(''),
  schedule: z.string().regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-7])|\*\/([0-7]))$/, {
    message: 'Invalid cron expression',
  }),
  exclude: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(10).default(5),
  retryAttempts: z.number().int().min(0).default(3),
  retryDelayMs: z.number().int().min(1000).default(60000),
  templateId: z.string().optional(),
  retentionPolicyId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.any().optional(),
});

export const updateJobSchema = z.object({
  description: z.string().optional(),
  source: z.string().min(1).optional(),
  bucket: z.string().min(1).optional(),
  prefix: z.string().optional(),
  schedule: z.string().regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-7])|\*\/([0-7]))$/, {
    message: 'Invalid cron expression',
  }).optional(),
  exclude: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  retryAttempts: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().min(1000).optional(),
  templateId: z.string().optional(),
  retentionPolicyId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
