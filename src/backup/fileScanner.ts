import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * スキャンされたファイル情報
 */
export interface ScannedFile {
  relativePath: string;
  absolutePath: string;
  size: number;
  hash: string;
  modifiedTime: Date;
}

/**
 * ファイルのMD5ハッシュを計算
 */
export function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * パターンがファイルパスにマッチするかチェック
 */
function matchesExcludePattern(filePath: string, pattern: string): boolean {
  // 簡易的なグロブマッチング
  if (pattern.endsWith('/')) {
    // ディレクトリパターン
    return filePath.includes(pattern.slice(0, -1));
  }
  if (pattern.startsWith('*.')) {
    // 拡張子パターン
    const ext = pattern.slice(1);
    return filePath.endsWith(ext);
  }
  // 完全一致
  return filePath.includes(pattern);
}

/**
 * ディレクトリを再帰的にスキャンしてファイルリストを取得
 */
export async function scanDirectory(
  sourcePath: string,
  excludePatterns: string[] = []
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];

  async function scanRecursive(currentPath: string, basePath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      // 除外パターンのチェック
      const shouldExclude = excludePatterns.some((pattern) =>
        matchesExcludePattern(relativePath, pattern)
      );

      if (shouldExclude) {
        continue;
      }

      if (entry.isDirectory()) {
        // ディレクトリの場合は再帰的にスキャン
        await scanRecursive(fullPath, basePath);
      } else if (entry.isFile()) {
        // ファイルの場合は情報を収集
        const stats = fs.statSync(fullPath);
        const hash = await calculateFileHash(fullPath);

        files.push({
          relativePath,
          absolutePath: fullPath,
          size: stats.size,
          hash,
          modifiedTime: stats.mtime,
        });
      }
    }
  }

  // ソースパスの存在確認
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const stats = fs.statSync(sourcePath);
  if (!stats.isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourcePath}`);
  }

  await scanRecursive(sourcePath, sourcePath);

  return files;
}

/**
 * ハッシュキャッシュの型定義
 */
export interface HashCache {
  [filePath: string]: {
    hash: string;
    size: number;
    modifiedTime: string;
  };
}

/**
 * ハッシュキャッシュを保存/読み込みするためのヘルパー
 */
export class HashCacheManager {
  private cacheFilePath: string;

  constructor(cacheDir: string = '.backup-cache') {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cacheFilePath = path.join(cacheDir, 'hash-cache.json');
  }

  loadCache(): HashCache {
    if (!fs.existsSync(this.cacheFilePath)) {
      return {};
    }
    try {
      const data = fs.readFileSync(this.cacheFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load hash cache, starting fresh');
      return {};
    }
  }

  saveCache(cache: HashCache): void {
    try {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.warn('Failed to save hash cache:', error);
    }
  }
}
