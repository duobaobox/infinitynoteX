/**
 * Storage Utils 测试
 * 测试存储模块的工具函数
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  generateId,
  generateConversationTitle,
  copyDirectory,
  deleteDirectory,
  calculateDirectorySize,
  validateMigrationPath,
  validateStorageIntegrity,
} from '../../../../electron/storage/utils';
import { StorageErrorCode } from '../../../../electron/storage/errors';

describe('generateId', () => {
  it('should generate a hex string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate 16 character string (8 bytes = 16 hex chars)', () => {
    const id = generateId();
    expect(id).toHaveLength(16);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('generateConversationTitle', () => {
  it('should generate title with current time if no timestamp provided', () => {
    const title = generateConversationTitle();
    expect(title).toMatch(/^对话\d{8}-\d{4}$/);
  });

  it('should generate title with provided timestamp', () => {
    // 2024-01-15 14:30:00
    const timestamp = new Date(2024, 0, 15, 14, 30, 0).getTime();
    const title = generateConversationTitle(timestamp);
    expect(title).toBe('对话20240115-1430');
  });

  it('should pad single digit month/day/hour/minute', () => {
    // 2024-03-05 09:05:00
    const timestamp = new Date(2024, 2, 5, 9, 5, 0).getTime();
    const title = generateConversationTitle(timestamp);
    expect(title).toBe('对话20240305-0905');
  });
});

describe('directory utils', () => {
  const createTempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'storage-utils-'));

  it('copyDirectory skips temp/backups and copies files', async () => {
    const src = await createTempDir();
    const dest = await createTempDir();

    // prepare source structure
    await fs.writeFile(path.join(src, 'a.txt'), 'hello');
    await fs.mkdir(path.join(src, 'nested'));
    await fs.writeFile(path.join(src, 'nested', 'b.txt'), 'world');
    await fs.mkdir(path.join(src, 'temp'));
    await fs.writeFile(path.join(src, 'temp', 'skip.txt'), 'skip');
    await fs.mkdir(path.join(src, 'backups'));
    await fs.writeFile(path.join(src, 'backups', 'skip.txt'), 'skip');

    await copyDirectory(src, dest);

    await expect(fs.readFile(path.join(dest, 'a.txt'), 'utf-8')).resolves.toBe('hello');
    await expect(fs.readFile(path.join(dest, 'nested', 'b.txt'), 'utf-8')).resolves.toBe('world');
    // skipped
    await expect(fs.stat(path.join(dest, 'temp'))).rejects.toBeInstanceOf(Error);
    await expect(fs.stat(path.join(dest, 'backups'))).rejects.toBeInstanceOf(Error);

    await deleteDirectory(src);
    await deleteDirectory(dest);
  });

  it('deleteDirectory removes nested contents', async () => {
    const dir = await createTempDir();
    await fs.mkdir(path.join(dir, 'nested'));
    await fs.writeFile(path.join(dir, 'nested', 'c.txt'), 'data');

    await deleteDirectory(dir);

    await expect(fs.stat(dir)).rejects.toBeInstanceOf(Error);
  });

  it('calculateDirectorySize sums files recursively', async () => {
    const dir = await createTempDir();
    await fs.writeFile(path.join(dir, 'x.bin'), Buffer.alloc(10));
    await fs.mkdir(path.join(dir, 'sub'));
    await fs.writeFile(path.join(dir, 'sub', 'y.bin'), Buffer.alloc(5));

    const size = await calculateDirectorySize(dir);
    expect(size).toBe(15);

    await deleteDirectory(dir);
  });

  it('validateMigrationPath creates empty dir and rejects non-empty', async () => {
    const emptyDir = path.join(os.tmpdir(), `migration-empty-${Date.now()}`);
    await validateMigrationPath(emptyDir); // should create
    await expect(fs.stat(emptyDir)).resolves.toBeTruthy();

    const nonEmpty = await createTempDir();
    await fs.writeFile(path.join(nonEmpty, 'file.txt'), 'x');
    await expect(validateMigrationPath(nonEmpty)).rejects.toMatchObject({
      code: StorageErrorCode.E_PATH_INVALID,
    });

    await deleteDirectory(emptyDir);
    await deleteDirectory(nonEmpty);
  });

  it('validateStorageIntegrity checks required files', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'meta.json'), '{}');
    await fs.writeFile(path.join(root, 'folders.json'), '[]');
    await fs.writeFile(path.join(root, 'notes.index.json'), '[]');
    await fs.writeFile(path.join(root, 'ai-conversations.index.json'), '[]');

    await expect(validateStorageIntegrity(root)).resolves.toBeUndefined();

    await fs.rm(path.join(root, 'folders.json'));
    await expect(validateStorageIntegrity(root)).rejects.toThrow(/Missing required file/);

    await deleteDirectory(root);
  });
});
