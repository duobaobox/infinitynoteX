/**
 * 存储模块通用工具函数
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { StorageError, StorageErrorCode } from './errors';

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取 JSON 文件
 * @param filePath 文件路径
 * @param defaultValue 默认值（文件不存在或读取失败时返回）
 * @param schema 可选的 Zod Schema，用于数据校验
 */
export async function readJsonFile<T>(
  filePath: string,
  defaultValue?: T,
  schema?: { parse: (data: unknown) => T },
): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // 如果提供了 schema，进行校验
    if (schema) {
      try {
        return schema.parse(data);
      } catch (error) {
        // Schema 校验失败
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new StorageError(
          StorageErrorCode.E_IO_READ,
          `Data validation failed for file: ${filePath}\n${errorMsg}`,
          error,
        );
      }
    }

    return data;
  } catch (error) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // 如果不是 StorageError，包装成 StorageError
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(StorageErrorCode.E_IO_READ, `Failed to read file: ${filePath}`, error);
  }
}

/**
 * 写入 JSON 文件
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new StorageError(StorageErrorCode.E_IO_WRITE, `Failed to write file: ${filePath}`, error);
  }
}

/**
 * 原子写入 JSON 文件
 * 先写临时文件，再重命名
 */
export async function writeJsonFileAtomic(
  filePath: string,
  data: unknown,
  tempDir: string,
): Promise<void> {
  // 为便签文件添加特殊前缀，便于崩溃恢复时识别
  const normalizedPath = filePath.split(path.sep).join('/');
  const isNoteFile = normalizedPath.includes('/notes/');
  const isAIConversationFile = normalizedPath.includes('/ai-conversations/');
  const baseName = path.basename(filePath);
  let tempFileName = `${baseName}.tmp`;
  if (isNoteFile) {
    tempFileName = `note-${baseName}.tmp`;
  } else if (isAIConversationFile) {
    tempFileName = `ai-conversation-${baseName}.tmp`;
  }
  const tempPath = path.join(tempDir, tempFileName);

  try {
    // 确保临时目录存在
    await fs.mkdir(tempDir, { recursive: true });

    // 写入临时文件
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(tempPath, content, 'utf-8');

    // 尝试原子重命名，如果失败（跨分区）则使用 copyFile + unlink
    try {
      await fs.rename(tempPath, filePath);
    } catch (renameError) {
      // rename 跨分区可能失败，fallback 到 copyFile + unlink
      await fs.copyFile(tempPath, filePath);
      await fs.unlink(tempPath);
    }
  } catch (error) {
    // 输出详细错误信息
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Storage] Atomic write failed for ${filePath}:`, errorMsg);

    // 清理临时文件
    try {
      await fs.unlink(tempPath);
    } catch {}

    throw new StorageError(
      StorageErrorCode.E_IO_WRITE,
      `Failed to write file atomically: ${filePath}`,
      error,
    );
  }
}

/**
 * 拷贝目录
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // 跳过 temp 和 backups 目录
      if (entry.name === 'temp' || entry.name === 'backups') {
        continue;
      }
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 递归删除目录
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await deleteDirectory(fullPath);
      } else {
        await fs.unlink(fullPath);
      }
    }

    await fs.rmdir(dirPath);
  } catch (error) {
    console.error(`[Storage] Failed to delete directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * 计算目录大小
 */
export async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await calculateDirectorySize(entryPath);
      } else {
        const stats = await fs.stat(entryPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`[Storage] Error calculating size for ${dirPath}:`, error);
  }
  return totalSize;
}

/**
 * 校验迁移路径
 */
export async function validateMigrationPath(targetPath: string): Promise<void> {
  try {
    // 检查目录是否存在
    const exists = await fileExists(targetPath);
    if (exists) {
      // 检查是否为空目录
      const files = await fs.readdir(targetPath);
      if (files.length > 0) {
        throw new Error('Target directory is not empty');
      }
    } else {
      // 创建目录
      await fs.mkdir(targetPath, { recursive: true });
    }

    // 检查是否可写
    await fs.access(targetPath, fsSync.constants.W_OK);
  } catch (error) {
    throw new StorageError(StorageErrorCode.E_PATH_INVALID, 'Invalid migration path', error);
  }
}

/**
 * 校验存储完整性
 * 注意：.index.json 文件已被 SQLite 缓存替代，不再检查
 */
export async function validateStorageIntegrity(storagePath: string): Promise<void> {
  const requiredFiles = ['meta.json', 'folders.json'];
  for (const file of requiredFiles) {
    const filePath = path.join(storagePath, file);
    const exists = await fileExists(filePath);
    if (!exists) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
}

/**
 * 生成对话标题（格式：对话YYYYMMDD-HHmm）
 */
export function generateConversationTitle(timestamp?: number): string {
  const date = new Date(timestamp || Date.now());
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `对话${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
