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
  return JSON.stringify(content, Object.keys(content as object).sort(), 0);
}

/**
 * 计算字符串的 MD5 哈希
 */
export function md5(content: string): string {
  return crypto.createHash('md5').update(content, 'utf8').digest('hex');
}

/**
 * 计算 JSON 内容的哈希（先规范化）
 */
export function hashJsonContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    const normalized = normalizeJson(parsed);
    return md5(normalized);
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
export async function scanLocalFiles(storagePath: string): Promise<LocalFileInfo[]> {
  const files: LocalFileInfo[] = [];

  // 扫描单独的文件
  for (const fileName of SYNC_FILES) {
    const filePath = path.join(storagePath, fileName);
    try {
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      files.push({
        path: fileName,
        hash: hashJsonContent(content),
        modifiedAt: stat.mtimeMs,
        size: stat.size,
        content,
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
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue;
        }
        const relativePath = `${dirName}/${entry.name}`;
        const filePath = path.join(dirPath, entry.name);
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          files.push({
            path: relativePath,
            hash: hashJsonContent(content),
            modifiedAt: stat.mtimeMs,
            size: stat.size,
            content,
          });
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
 */
export async function readLocalSyncState(storagePath: string): Promise<LocalSyncState | null> {
  const statePath = path.join(storagePath, LOCAL_STATE_FILE);
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as LocalSyncState;
  } catch {
    return null;
  }
}

/**
 * 保存本地同步状态
 */
export async function writeLocalSyncState(
  storagePath: string,
  state: LocalSyncState,
): Promise<void> {
  const statePath = path.join(storagePath, LOCAL_STATE_FILE);
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
