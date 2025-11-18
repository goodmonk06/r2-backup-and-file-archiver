import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getR2Client } from '../../config/r2Client.js';
import {
  IStorageAdapter,
  UploadOptions,
  DownloadOptions,
  DeleteOptions,
  ListOptions,
  ListResult,
} from './IStorageAdapter.js';

/**
 * Cloudflare R2 Storage Adapter
 * Implements IStorageAdapter using S3-compatible APIs
 */
export class R2StorageAdapter implements IStorageAdapter {
  readonly name = 'r2';
  private client: S3Client;

  constructor(client?: S3Client) {
    this.client = client || getR2Client();
  }

  async upload(options: UploadOptions): Promise<{ etag: string; versionId?: string }> {
    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body as any, // AWS SDK accepts Buffer and Readable streams
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    const response = await this.client.send(command);

    return {
      etag: response.ETag || '',
      versionId: response.VersionId,
    };
  }

  async download(options: DownloadOptions): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    const response = await this.client.send(command);
    const chunks: Buffer[] = [];

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async delete(options: DeleteOptions): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    await this.client.send(command);
  }

  async list(options: ListOptions): Promise<ListResult> {
    const command = new ListObjectsV2Command({
      Bucket: options.bucket,
      Prefix: options.prefix,
      MaxKeys: options.maxKeys || 1000,
      ContinuationToken: options.continuationToken,
    });

    const response = await this.client.send(command);

    return {
      objects:
        response.Contents?.map((obj) => ({
          key: obj.Key!,
          size: obj.Size!,
          lastModified: obj.LastModified!,
          etag: obj.ETag,
        })) || [],
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated || false,
    };
  }

  async exists(options: { bucket: string; key: string }): Promise<boolean> {
    try {
      await this.getMetadata(options);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(options: { bucket: string; key: string }): Promise<{
    size: number;
    lastModified: Date;
    etag?: string;
    metadata?: Record<string, string>;
  }> {
    const command = new HeadObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
    });

    const response = await this.client.send(command);

    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      etag: response.ETag,
      metadata: response.Metadata,
    };
  }
}
