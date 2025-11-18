import { Request, Response } from 'express';
import { jobService } from '../../services/job.service.js';
import { createJobSchema, updateJobSchema } from '../../validators/job.schema.js';

export class JobController {
  async createJob(req: Request, res: Response) {
    const data = createJobSchema.parse(req.body);
    const job = await jobService.createJob(data);

    res.status(201).json({
      success: true,
      data: job,
    });
  }

  async getAllJobs(req: Request, res: Response) {
    const includeDisabled = req.query.includeDisabled === 'true';
    const jobs = await jobService.getAllJobs(includeDisabled);

    res.json({
      success: true,
      data: jobs,
    });
  }

  async getJobByName(req: Request, res: Response) {
    const { name } = req.params;
    const job = await jobService.getJobByName(name);

    res.json({
      success: true,
      data: job,
    });
  }

  async updateJob(req: Request, res: Response) {
    const { name } = req.params;
    const data = updateJobSchema.parse(req.body);
    const job = await jobService.updateJob(name, data);

    res.json({
      success: true,
      data: job,
    });
  }

  async deleteJob(req: Request, res: Response) {
    const { name } = req.params;
    const job = await jobService.deleteJob(name);

    res.json({
      success: true,
      data: job,
    });
  }

  async runBackup(req: Request, res: Response) {
    const { name } = req.params;
    const result = await jobService.runBackup(name);

    res.json({
      success: true,
      data: result,
    });
  }

  async getHistory(req: Request, res: Response) {
    const { name } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const history = await jobService.getHistory(name, limit);

    res.json({
      success: true,
      data: history,
    });
  }
}

export const jobController = new JobController();
