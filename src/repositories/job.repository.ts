import { BackupJob, BackupHistory, Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import { CreateJobInput, UpdateJobInput } from '../validators/job.schema.js';

export class JobRepository {
  async create(data: CreateJobInput): Promise<BackupJob> {
    return prisma.backupJob.create({
      data,
    });
  }

  async findAll(includeDisabled = false): Promise<BackupJob[]> {
    return prisma.backupJob.findMany({
      where: includeDisabled ? {} : { enabled: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByName(name: string): Promise<BackupJob | null> {
    return prisma.backupJob.findUnique({
      where: { name },
      include: {
        histories: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async findById(id: string): Promise<BackupJob | null> {
    return prisma.backupJob.findUnique({
      where: { id },
    });
  }

  async update(name: string, data: UpdateJobInput): Promise<BackupJob> {
    return prisma.backupJob.update({
      where: { name },
      data,
    });
  }

  async delete(name: string): Promise<BackupJob> {
    return prisma.backupJob.delete({
      where: { name },
    });
  }

  async createHistory(data: {
    jobId: string;
    jobName: string;
    totalFiles: number;
    uploadedFiles: number;
    skippedFiles: number;
    errors: string[];
    startTime: Date;
    endTime: Date;
    duration: number;
    status: string;
  }): Promise<BackupHistory> {
    return prisma.backupHistory.create({
      data,
    });
  }

  async getHistory(jobName: string, limit = 50): Promise<BackupHistory[]> {
    return prisma.backupHistory.findMany({
      where: { jobName },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const jobRepository = new JobRepository();
