import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { getR2Client } from '../config/r2Client.js';
import { BackupJob } from '../config-loader/backupConfigLoader.js';
import {
  scanDirectory,
  ScannedFile,
  HashCacheManager,
  HashCache,
} from './fileScanner.js';

/**
 * バックアップ実行結果
 */
export interface BackupResult {
  jobName: string;
  totalFiles: number;
  uploadedFiles: number;
  skippedFiles: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * シンプルなロガー
 */
class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`[INFO] ${message}`);
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`);
    }
  }
}

/**
 * バックアップランナー
 */
export class BackupRunner {
  private logger: Logger;
  private cacheManager: HashCacheManager;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logger = new Logger(logLevel);
    this.cacheManager = new HashCacheManager();
  }

  /**
   * R2上のファイルが既に存在するかチェック
   */
  private async fileExistsInR2(
    bucket: string,
    key: string,
    localHash: string
  ): Promise<boolean> {
    const client = getR2Client();

    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await client.send(command);

      // ETagがMD5ハッシュと一致するかチェック
      // R2のETagはクォートで囲まれているので除去
      const remoteEtag = response.ETag?.replace(/"/g, '');
      return remoteEtag === localHash;
    } catch (error: any) {
      // ファイルが存在しない場合は404エラー
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      // その他のエラーは再スロー
      throw error;
    }
  }

  /**
   * ファイルをR2にアップロード
   */
  private async uploadFile(
    file: ScannedFile,
    bucket: string,
    prefix: string
  ): Promise<void> {
    const client = getR2Client();
    const key = path.join(prefix, file.relativePath).replace(/\\/g, '/');

    this.logger.debug(`Uploading: ${file.relativePath} -> ${key}`);

    const fileStream = fs.createReadStream(file.absolutePath);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: this.getContentType(file.absolutePath),
      Metadata: {
        'original-path': file.relativePath,
        'file-hash': file.hash,
      },
    });

    await client.send(command);
  }

  /**
   * ファイルのContent-Typeを推測
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * バックアップジョブを実行
   */
  async runBackup(job: BackupJob): Promise<BackupResult> {
    const startTime = new Date();
    const errors: string[] = [];

    this.logger.info(`Starting backup job: ${job.name}`);
    this.logger.info(`Source: ${job.source}`);
    this.logger.info(`Destination: ${job.bucket}/${job.prefix}`);

    // ソースディレクトリをスキャン
    this.logger.info('Scanning files...');
    let files: ScannedFile[];
    try {
      files = await scanDirectory(job.source, job.exclude);
      this.logger.info(`Found ${files.length} files`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to scan directory: ${errorMsg}`);
      throw error;
    }

    // キャッシュを読み込み
    const cache = this.cacheManager.loadCache();
    const newCache: HashCache = {};

    let uploadedFiles = 0;
    let skippedFiles = 0;

    // 各ファイルを処理
    for (const file of files) {
      try {
        // キャッシュをチェックして、変更されていないファイルはスキップ
        const cacheKey = file.relativePath;
        const cached = cache[cacheKey];

        let needsUpload = true;

        if (
          cached &&
          cached.hash === file.hash &&
          cached.size === file.size &&
          cached.modifiedTime === file.modifiedTime.toISOString()
        ) {
          // キャッシュと一致する場合、R2にも存在するかチェック
          const key = path.join(job.prefix, file.relativePath).replace(/\\/g, '/');
          const existsInR2 = await this.fileExistsInR2(job.bucket, key, file.hash);

          if (existsInR2) {
            needsUpload = false;
            skippedFiles++;
            this.logger.debug(`Skipped (unchanged): ${file.relativePath}`);
          }
        }

        if (needsUpload) {
          await this.uploadFile(file, job.bucket, job.prefix);
          uploadedFiles++;
          this.logger.info(`Uploaded: ${file.relativePath}`);
        }

        // 新しいキャッシュに追加
        newCache[cacheKey] = {
          hash: file.hash,
          size: file.size,
          modifiedTime: file.modifiedTime.toISOString(),
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to upload ${file.relativePath}: ${errorMsg}`);
        errors.push(`${file.relativePath}: ${errorMsg}`);
      }
    }

    // キャッシュを保存
    this.cacheManager.saveCache(newCache);

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result: BackupResult = {
      jobName: job.name,
      totalFiles: files.length,
      uploadedFiles,
      skippedFiles,
      errors,
      startTime,
      endTime,
      duration,
    };

    this.logger.info('Backup completed');
    this.logger.info(`Total files: ${result.totalFiles}`);
    this.logger.info(`Uploaded: ${result.uploadedFiles}`);
    this.logger.info(`Skipped: ${result.skippedFiles}`);
    this.logger.info(`Errors: ${result.errors.length}`);
    this.logger.info(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

    return result;
  }
}
