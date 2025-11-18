import { BackupTemplate, Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';

export interface CreateTemplateInput {
  name: string;
  description?: string;
  source: string;
  bucket: string;
  prefix: string;
  schedule: string;
  exclude?: string[];
  priority?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  tags?: string[];
  variables?: any;
  metadata?: any;
  isPublic?: boolean;
  createdBy?: string;
}

export interface UpdateTemplateInput {
  description?: string;
  source?: string;
  bucket?: string;
  prefix?: string;
  schedule?: string;
  exclude?: string[];
  priority?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  tags?: string[];
  variables?: any;
  metadata?: any;
  isPublic?: boolean;
}

export class TemplateRepository {
  async create(data: CreateTemplateInput): Promise<BackupTemplate> {
    return prisma.backupTemplate.create({
      data: data as Prisma.BackupTemplateCreateInput,
    });
  }

  async findAll(onlyPublic = false): Promise<BackupTemplate[]> {
    return prisma.backupTemplate.findMany({
      where: onlyPublic ? { isPublic: true } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByName(name: string): Promise<BackupTemplate | null> {
    return prisma.backupTemplate.findUnique({
      where: { name },
      include: {
        jobs: {
          select: {
            id: true,
            name: true,
            enabled: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<BackupTemplate | null> {
    return prisma.backupTemplate.findUnique({
      where: { id },
    });
  }

  async update(name: string, data: UpdateTemplateInput): Promise<BackupTemplate> {
    return prisma.backupTemplate.update({
      where: { name },
      data: data as Prisma.BackupTemplateUpdateInput,
    });
  }

  async delete(name: string): Promise<BackupTemplate> {
    return prisma.backupTemplate.delete({
      where: { name },
    });
  }
}

export const templateRepository = new TemplateRepository();
