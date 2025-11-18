/**
 * Storage Adapter Interface
 *
 * Abstracts different storage backends (R2, S3, Azure Blob, GCS, local filesystem)
 * allowing the backup system to support multiple storage providers.
 */

export interface UploadOptions {
  bucket: string;
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface DownloadOptions {
  bucket: string;
  key: string;
}

export interface DeleteOptions {
  bucket: string;
  key: string;
}

export interface ListOptions {
  bucket: string;
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

export interface ListResult {
  objects: StorageObject[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface IStorageAdapter {
  /**
   * Adapter name for identification
   */
  readonly name: string;

  /**
   * Upload a file to storage
   */
  upload(options: UploadOptions): Promise<{ etag: string; versionId?: string }>;

  /**
   * Download a file from storage
   */
  download(options: DownloadOptions): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * List objects in storage
   */
  list(options: ListOptions): Promise<ListResult>;

  /**
   * Check if an object exists
   */
  exists(options: { bucket: string; key: string }): Promise<boolean>;

  /**
   * Get object metadata
   */
  getMetadata(options: { bucket: string; key: string }): Promise<{
    size: number;
    lastModified: Date;
    etag?: string;
    metadata?: Record<string, string>;
  }>;
}
