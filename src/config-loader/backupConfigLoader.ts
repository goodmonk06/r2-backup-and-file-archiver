import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * バックアップジョブの定義
 */
export interface BackupJob {
  name: string;
  source: string;
  bucket: string;
  prefix: string;
  schedule: string;
  exclude?: string[];
  enabled: boolean;
}

/**
 * バックアップ設定ファイルの構造
 */
export interface BackupConfig {
  jobs: BackupJob[];
}

/**
 * YAMLファイルからバックアップ設定を読み込む
 */
export function loadBackupConfig(configPath: string): BackupConfig {
  try {
    // ファイルの存在確認
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    // YAMLファイルを読み込み
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as BackupConfig;

    // 基本的なバリデーション
    if (!config || !config.jobs || !Array.isArray(config.jobs)) {
      throw new Error('Invalid config format: jobs array is required');
    }

    // 各ジョブの検証
    config.jobs.forEach((job, index) => {
      if (!job.name) {
        throw new Error(`Job at index ${index} is missing 'name' field`);
      }
      if (!job.source) {
        throw new Error(`Job '${job.name}' is missing 'source' field`);
      }
      if (!job.bucket) {
        throw new Error(`Job '${job.name}' is missing 'bucket' field`);
      }
      if (!job.prefix) {
        throw new Error(`Job '${job.name}' is missing 'prefix' field`);
      }
      if (!job.schedule) {
        throw new Error(`Job '${job.name}' is missing 'schedule' field`);
      }
      // enabledのデフォルト値
      if (job.enabled === undefined) {
        job.enabled = true;
      }
    });

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load backup config: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 指定された名前のジョブを取得
 */
export function getJobByName(config: BackupConfig, jobName: string): BackupJob | undefined {
  return config.jobs.find((job) => job.name === jobName);
}

/**
 * 有効なジョブのみを取得
 */
export function getEnabledJobs(config: BackupConfig): BackupJob[] {
  return config.jobs.filter((job) => job.enabled);
}
