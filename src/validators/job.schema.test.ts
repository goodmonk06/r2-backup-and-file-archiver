import { describe, it, expect } from 'vitest';
import { createJobSchema, updateJobSchema } from './job.schema';

describe('Job Schema Validation', () => {
  describe('createJobSchema', () => {
    it('should validate a valid job creation payload', () => {
      const validJob = {
        name: 'test-job',
        source: './data',
        bucket: 'my-bucket',
        prefix: 'backups/',
        schedule: '0 3 * * *',
        exclude: ['*.tmp', '*.log'],
        enabled: true,
      };

      const result = createJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });

    it('should fail when name is missing', () => {
      const invalidJob = {
        source: './data',
        bucket: 'my-bucket',
        schedule: '0 3 * * *',
      };

      const result = createJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should fail with invalid cron expression', () => {
      const invalidJob = {
        name: 'test-job',
        source: './data',
        bucket: 'my-bucket',
        schedule: 'invalid-cron',
      };

      const result = createJobSchema.safeParse(invalidJob);
      expect(result.success).toBe(false);
    });

    it('should apply default values', () => {
      const minimalJob = {
        name: 'test-job',
        source: './data',
        bucket: 'my-bucket',
        schedule: '0 3 * * *',
      };

      const result = createJobSchema.parse(minimalJob);
      expect(result.prefix).toBe('');
      expect(result.exclude).toEqual([]);
      expect(result.enabled).toBe(true);
    });
  });

  describe('updateJobSchema', () => {
    it('should validate a valid update payload', () => {
      const validUpdate = {
        enabled: false,
        schedule: '0 4 * * *',
      };

      const result = updateJobSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const partialUpdate = {
        enabled: false,
      };

      const result = updateJobSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should fail with invalid cron expression', () => {
      const invalidUpdate = {
        schedule: 'not-a-cron',
      };

      const result = updateJobSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});
