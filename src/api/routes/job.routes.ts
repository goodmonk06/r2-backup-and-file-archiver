import { Router } from 'express';
import { jobController } from '../controllers/job.controller.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { createJobSchema, updateJobSchema } from '../../validators/job.schema.js';

const router = Router();

// Validation schemas for route params
const jobNameSchema = z.object({
  params: z.object({
    name: z.string(),
  }),
});

const createJobValidationSchema = z.object({
  body: createJobSchema,
});

const updateJobValidationSchema = z.object({
  body: updateJobSchema,
  params: z.object({
    name: z.string(),
  }),
});

// Routes
router.post(
  '/',
  validate(createJobValidationSchema),
  asyncHandler(jobController.createJob.bind(jobController))
);

router.get('/', asyncHandler(jobController.getAllJobs.bind(jobController)));

router.get(
  '/:name',
  validate(jobNameSchema),
  asyncHandler(jobController.getJobByName.bind(jobController))
);

router.put(
  '/:name',
  validate(updateJobValidationSchema),
  asyncHandler(jobController.updateJob.bind(jobController))
);

router.delete(
  '/:name',
  validate(jobNameSchema),
  asyncHandler(jobController.deleteJob.bind(jobController))
);

router.post(
  '/:name/run',
  validate(jobNameSchema),
  asyncHandler(jobController.runBackup.bind(jobController))
);

router.get(
  '/:name/history',
  validate(jobNameSchema),
  asyncHandler(jobController.getHistory.bind(jobController))
);

export default router;
