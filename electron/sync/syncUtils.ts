/**
 * 同步工具函数
 * 提供 MD5 哈希计算、文件扫描、JSON 规范化等功能
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { LocalFileInfo, LocalSyncState, RemoteSyncManifest } from './types';
import { getSyncFiles, getSyncDirectories } from '../storage/core/moduleRegistry';

/**
 * 需要同步的文件列表（从统一注册中心自动获取）
 * @see storage/core/moduleRegistry.ts 添加新的同步模块
 */
export const SYNC_FILES = getSyncFiles();

/**
 * 需要同步的目录（从统一注册中心自动获取）
 * @see storage/core/moduleRegistry.ts 添加新的同步模块
 */
export const SYNC_DIRS = getSyncDirectories();

/**
 * 远程同步目录名
 */
export const SYNC_META_DIR = '.sync';
export const MANIFEST_FILE = 'manifest.json';
export const LOCAL_STATE_FILE = 'sync-state.json';

/**
 * 规范化 JSON 内容
 * 确保相同内容生成相同的字符串（排序 keys）
 */
export function normalizeJson(content: unknown): string {
  return stableStringify(content);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(deepSortForStableJson(value));
}

function deepSortForStableJson(value: unknown): unknown {
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value.map((v) => deepSortForStableJson(v));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const v = obj[key];
      if (v === undefined) continue;
      result[key] = deepSortForStableJson(v);
    }
    return result;
  }

  return value;
}

/**
 * 计算字符串的 MD5 哈希
 */
export function md5(content: string): string {
  return crypto.createHash('md5').update(content, 'utf8').digest('hex');
}

/**
 * 计算二进制数据的 MD5 哈希
 */
export function md5Binary(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * 计算 JSON 内容的哈希（先规范化）
 */
export function hashJsonContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return md5(stableStringify(parsed));
  } catch {
    // 如果不是有效 JSON，直接计算原始内容哈希
    return md5(content);
  }
}

/**
 * 获取设备名称
 */
export function getDeviceName(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const platformNames: Record<string, string> = {
    darwin: 'Mac',
    win32: 'Windows',
    linux: 'Linux',
  };
  const platformName = platformNames[platform] || platform;

  return `${hostname} (${platformName})`;
}

/**
 * 生成设备 ID
 */
export function generateDeviceId(): string {
  return uuidv4();
}

/**
 * 扫描本地需要同步的文件
 * @param storagePath 存储根目录
 * @returns 文件信息列表
 */
export async function scanLocalFiles(
  storagePath: string,
  localSyncState?: LocalSyncState | null,
): Promise<LocalFileInfo[]> {
  const files: LocalFileInfo[] = [];

  // 扫描单独的文件（如 folders.json）
  for (const fileName of SYNC_FILES) {
    const filePath = path.join(storagePath, fileName);
    try {
      const stat = await fs.stat(filePath);

      // 增量检查：如果 mtime 没变，直接复用上次的 hash
      const savedState = localSyncState?.files[fileName];
      if (
        savedState &&
        savedState.localModifiedAt &&
        Math.abs(savedState.localModifiedAt - stat.mtimeMs) < 1 // 允许 1ms 误差
      ) {
        files.push({
          path: fileName,
          hash: savedState.syncedHash,
          modifiedAt: stat.mtimeMs,
          size: stat.size,
          // 增量模式下不加载 content，除非 verifyContent=true（此处简化，需在 SyncEngine 中处理上传时的 content 读取）
          // 但是 LocalFileInfo 类型定义里 content 是可选的
          // 如果需要上传，SyncEngine 会发现 hash 变了（或者没变），如果没变就不会上传，所以不需要 content
          // 如果 hash 变了，说明 mtime 肯定变了，这里就会重新读取 content
          // 唯一例外：mtime 没变但内容变了（极少见），或者 mtime 变了但内容没变
          // 现在的逻辑是：mtime 没变 -> 认为 hash 没变 -> 不读 content
          isBinary: false,
        });
        // 调试日志
        // console.log(`[Sync] Incremental scan skip: ${fileName}`);
        continue;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      files.push({
        path: fileName,
        hash: hashJsonContent(content),
        modifiedAt: stat.mtimeMs,
        size: stat.size,
        content,
        isBinary: false,
      });
    } catch (error) {
      // 文件不存在则跳过
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[Sync] Failed to scan file: ${fileName}`, error);
      }
    }
  }

  // 扫描目录
  for (const dirName of SYNC_DIRS) {
    const dirPath = path.join(storagePath, dirName);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        const relativePath = `${dirName}/${entry.name}`;
        const filePath = path.join(dirPath, entry.name);

        try {
          const stat = await fs.stat(filePath);
          const isJson = entry.name.endsWith('.json');

          // 增量检查
          const savedState = localSyncState?.files[relativePath];
          if (
            savedState &&
            savedState.localModifiedAt &&
            Math.abs(savedState.localModifiedAt - stat.mtimeMs) < 1
          ) {
            files.push({
              path: relativePath,
              hash: savedState.syncedHash,
              modifiedAt: stat.mtimeMs,
              size: stat.size,
              isBinary: !isJson,
            });
            continue;
          }

          if (isJson) {
            // JSON 文件：读取内容并计算规范化哈希
            const content = await fs.readFile(filePath, 'utf-8');
            files.push({
              path: relativePath,
              hash: hashJsonContent(content),
              modifiedAt: stat.mtimeMs,
              size: stat.size,
              content,
              isBinary: false,
            });
          } else {
            // 二进制文件（如图片）：只计算哈希，不加载内容
            const buffer = await fs.readFile(filePath);
            files.push({
              path: relativePath,
              hash: md5Binary(buffer),
              modifiedAt: stat.mtimeMs,
              size: stat.size,
              isBinary: true,
            });
          }
        } catch (error) {
          console.warn(`[Sync] Failed to scan file: ${relativePath}`, error);
        }
      }
    } catch (error) {
      // 目录不存在则跳过
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[Sync] Failed to scan directory: ${dirName}`, error);
      }
    }
  }

  return files;
}

/**
 * 读取本地同步状态
 * @param appPath 应用目录路径（存储同步系统文件）
 */
export async function readLocalSyncState(appPath: string): Promise<LocalSyncState | null> {
  const statePath = path.join(appPath, LOCAL_STATE_FILE);
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as LocalSyncState;
  } catch {
    return null;
  }
}

/**
 * 保存本地同步状态
 * @param appPath 应用目录路径（存储同步系统文件）
 */
export async function writeLocalSyncState(appPath: string, state: LocalSyncState): Promise<void> {
  const statePath = path.join(appPath, LOCAL_STATE_FILE);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 创建初始的本地同步状态
 */
export function createInitialSyncState(): LocalSyncState {
  return {
    deviceId: generateDeviceId(),
    deviceName: getDeviceName(),
    lastSyncAt: 0,
    files: {},
  };
}

/**
 * 创建初始的远程清单
 */
export function createInitialManifest(deviceId: string): RemoteSyncManifest {
  return {
    version: 1,
    updatedAt: Date.now(),
    updatedBy: deviceId,
    files: {},
  };
}

/**
 * 将相对路径转换为远程路径
 */
export function toRemotePath(remotePath: string, relativePath: string): string {
  return `${remotePath}/${relativePath}`;
}

/**
 * 将远程路径转换为相对路径
 */
export function toRelativePath(remotePath: string, fullPath: string): string {
  const prefix = remotePath.endsWith('/') ? remotePath : `${remotePath}/`;
  if (fullPath.startsWith(prefix)) {
    return fullPath.slice(prefix.length);
  }
  return fullPath;
}

/**
 * 检查路径是否在同步范围内
 * 使用统一注册中心的实现
 * @see storage/core/moduleRegistry.ts
 */
export { isPathInSyncScope } from '../storage/core/moduleRegistry';

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 安全写入文件（先写临时文件再重命名）
 */
export async function safeWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempPath = `${filePath}.tmp.${Date.now()}`;
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * 删除文件（忽略不存在的情况）
 */
export async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
