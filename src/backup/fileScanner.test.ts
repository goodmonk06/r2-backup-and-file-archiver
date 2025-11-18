import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateFileHash, HashCacheManager } from './fileScanner';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('File Scanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2backup-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('calculateFileHash', () => {
    it('should calculate MD5 hash of a file', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'Hello World');

      const hash = await calculateFileHash(testFile);

      // MD5 of "Hello World" is b10a8db164e0754105b7a99be72e3fe5
      expect(hash).toBe('b10a8db164e0754105b7a99be72e3fe5');
    });

    it('should calculate different hashes for different content', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');

      fs.writeFileSync(file1, 'Content 1');
      fs.writeFileSync(file2, 'Content 2');

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });

    it('should calculate same hash for identical content', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');

      fs.writeFileSync(file1, 'Same content');
      fs.writeFileSync(file2, 'Same content');

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('HashCacheManager', () => {
    it('should save and load cache', () => {
      const cacheDir = path.join(tempDir, '.cache');
      const manager = new HashCacheManager(cacheDir);

      const cache = {
        'file1.txt': {
          hash: 'abc123',
          size: 100,
          modifiedTime: new Date().toISOString(),
        },
        'file2.txt': {
          hash: 'def456',
          size: 200,
          modifiedTime: new Date().toISOString(),
        },
      };

      manager.saveCache(cache);
      const loaded = manager.loadCache();

      expect(loaded).toEqual(cache);
    });

    it('should return empty cache when file does not exist', () => {
      const cacheDir = path.join(tempDir, '.nonexistent');
      const manager = new HashCacheManager(cacheDir);

      const cache = manager.loadCache();
      expect(cache).toEqual({});
    });

    it('should create cache directory if it does not exist', () => {
      const cacheDir = path.join(tempDir, '.newcache');
      expect(fs.existsSync(cacheDir)).toBe(false);

      new HashCacheManager(cacheDir);
      expect(fs.existsSync(cacheDir)).toBe(true);
    });
  });
});
