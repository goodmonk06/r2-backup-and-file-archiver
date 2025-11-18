import { BackupJob } from '@prisma/client';
import { jobRepository } from '../repositories/job.repository.js';
import { CreateJobInput, UpdateJobInput } from '../validators/job.schema.js';
import { BackupRunner, LogLevel } from '../backup/backupRunner.js';
import { BackupJob as ConfigBackupJob } from '../config-loader/backupConfigLoader.js';

export class JobService {
  private runner: BackupRunner;

  constructor() {
    this.runner = new BackupRunner(LogLevel.INFO);
  }

  async createJob(data: CreateJobInput): Promise<BackupJob> {
    // Check if job with same name already exists
    const existing = await jobRepository.findByName(data.name);
    if (existing) {
      throw new Error(`Job with name '${data.name}' already exists`);
    }

    return jobRepository.create(data);
  }

  async getAllJobs(includeDisabled = false): Promise<BackupJob[]> {
    return jobRepository.findAll(includeDisabled);
  }

  async getJobByName(name: string): Promise<BackupJob> {
    const job = await jobRepository.findByName(name);
    if (!job) {
      throw new Error(`Job '${name}' not found`);
    }
    return job;
  }

  async updateJob(name: string, data: UpdateJobInput): Promise<BackupJob> {
    const existing = await jobRepository.findByName(name);
    if (!existing) {
      throw new Error(`Job '${name}' not found`);
    }

    return jobRepository.update(name, data);
  }

  async deleteJob(name: string): Promise<BackupJob> {
    const existing = await jobRepository.findByName(name);
    if (!existing) {
      throw new Error(`Job '${name}' not found`);
    }

    return jobRepository.delete(name);
  }

  async runBackup(name: string): Promise<any> {
    const job = await this.getJobByName(name);

    // Convert DB job to ConfigBackupJob format
    const configJob: ConfigBackupJob = {
      name: job.name,
      source: job.source,
      bucket: job.bucket,
      prefix: job.prefix,
      schedule: job.schedule,
      exclude: job.exclude,
      enabled: job.enabled,
    };

    // Run backup
    const result = await this.runner.runBackup(configJob);

    // Save history
    const status =
      result.errors.length === 0
        ? 'success'
        : result.uploadedFiles > 0
        ? 'partial'
        : 'failed';

    await jobRepository.createHistory({
      jobId: job.id,
      jobName: job.name,
      totalFiles: result.totalFiles,
      uploadedFiles: result.uploadedFiles,
      skippedFiles: result.skippedFiles,
      errors: result.errors,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.duration,
      status,
    });

    return result;
  }

  async getHistory(name: string, limit = 50) {
    const job = await jobRepository.findByName(name);
    if (!job) {
      throw new Error(`Job '${name}' not found`);
    }

    return jobRepository.getHistory(name, limit);
  }
}

export const jobService = new JobService();
