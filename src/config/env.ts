import dotenv from 'dotenv';
import path from 'path';

// .envファイルを読み込み
dotenv.config();

export interface EnvConfig {
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Endpoint: string;
  backupConfigPath: string;
  logLevel: string;
}

/**
 * 環境変数を読み込み、検証する
 */
export function loadEnvConfig(): EnvConfig {
  const requiredVars = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_ENDPOINT',
  ];

  // 必須環境変数のチェック
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file.'
    );
  }

  return {
    r2AccountId: process.env.R2_ACCOUNT_ID!,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID!,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    r2Endpoint: process.env.R2_ENDPOINT!,
    backupConfigPath: process.env.BACKUP_CONFIG_PATH || './config/backup.yml',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

// シングルトンインスタンス
let envConfig: EnvConfig | null = null;

/**
 * 環境設定を取得（シングルトン）
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    envConfig = loadEnvConfig();
  }
  return envConfig;
}
