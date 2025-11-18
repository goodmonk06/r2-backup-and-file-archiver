import { S3Client } from '@aws-sdk/client-s3';
import { getEnvConfig } from './env.js';

/**
 * Cloudflare R2クライアントを作成
 * R2はS3互換APIを提供しているため、AWS SDKのS3Clientを使用
 */
export function createR2Client(): S3Client {
  const config = getEnvConfig();

  const client = new S3Client({
    region: 'auto', // R2は'auto'を使用
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });

  return client;
}

// シングルトンインスタンス
let r2Client: S3Client | null = null;

/**
 * R2クライアントを取得（シングルトン）
 */
export function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = createR2Client();
  }
  return r2Client;
}
