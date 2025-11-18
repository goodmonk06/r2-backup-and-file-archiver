import { BackupTemplate } from '@prisma/client';
import {
  templateRepository,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../repositories/template.repository.js';
import { jobRepository } from '../repositories/job.repository.js';

export class TemplateService {
  async createTemplate(data: CreateTemplateInput): Promise<BackupTemplate> {
    const existing = await templateRepository.findByName(data.name);
    if (existing) {
      throw new Error(`Template with name '${data.name}' already exists`);
    }

    return templateRepository.create(data);
  }

  async getAllTemplates(onlyPublic = false): Promise<BackupTemplate[]> {
    return templateRepository.findAll(onlyPublic);
  }

  async getTemplateByName(name: string): Promise<BackupTemplate> {
    const template = await templateRepository.findByName(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }
    return template;
  }

  async updateTemplate(
    name: string,
    data: UpdateTemplateInput
  ): Promise<BackupTemplate> {
    const existing = await templateRepository.findByName(name);
    if (!existing) {
      throw new Error(`Template '${name}' not found`);
    }

    return templateRepository.update(name, data);
  }

  async deleteTemplate(name: string): Promise<BackupTemplate> {
    const existing = await templateRepository.findByName(name);
    if (!existing) {
      throw new Error(`Template '${name}' not found`);
    }

    return templateRepository.delete(name);
  }

  /**
   * Instantiate a job from a template
   */
  async instantiateJob(
    templateName: string,
    variables: Record<string, string>,
    jobName?: string
  ): Promise<any> {
    const template = await this.getTemplateByName(templateName);

    // Replace variables in source and prefix
    let source = template.source;
    let prefix = template.prefix;

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `\${${key}}`;
      source = source.replace(new RegExp(placeholder, 'g'), value);
      prefix = prefix.replace(new RegExp(placeholder, 'g'), value);
    });

    const name = jobName || `${template.name}-${Date.now()}`;

    return jobRepository.create({
      name,
      source,
      bucket: template.bucket,
      prefix,
      schedule: template.schedule,
      exclude: template.exclude,
      priority: template.priority,
      retryAttempts: template.retryAttempts,
      retryDelayMs: template.retryDelayMs,
      tags: template.tags,
      templateId: template.id,
      enabled: true,
    });
  }
}

export const templateService = new TemplateService();
