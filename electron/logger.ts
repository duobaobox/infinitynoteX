/**
 * 日志模块
 * 基于 electron-log 提供统一的日志功能
 */

import log from 'electron-log';
import { shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

// 配置日志
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// 日志文件格式
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}';

// 日志文件大小限制（5MB）
log.transports.file.maxSize = 5 * 1024 * 1024;

// 日志保留天数
const LOG_RETENTION_DAYS = 7;

// 捕获未处理的异常
log.catchErrors({
  showDialog: false,
  onError: (error) => {
    log.error('Uncaught exception:', error);
  },
});

// 重写 console 方法，使其同时写入日志文件
// 这样现有的 console.log 都会被记录
Object.assign(console, log.functions);

/**
 * 获取日志文件路径
 */
export function getLogPath(): string {
  return log.transports.file.getFile().path;
}

/**
 * 获取日志目录
 */
export function getLogDir(): string {
  return path.dirname(getLogPath());
}

/**
 * 在系统文件管理器中打开日志目录
 */
export async function openLogDir(): Promise<void> {
  const logDir = getLogDir();
  await shell.openPath(logDir);
}

/**
 * 读取最近的日志内容
 */
export async function readRecentLogs(lines: number = 200): Promise<string> {
  const logPath = getLogPath();

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const allLines = content.split('\n');
    const recentLines = allLines.slice(-lines);
    return recentLines.join('\n');
  } catch (error) {
    return `无法读取日志: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}

/**
 * 按级别筛选日志
 */
export async function readLogsByLevel(
  level: 'error' | 'warn' | 'info' | 'debug' | 'all',
  lines: number = 500,
): Promise<string> {
  const logPath = getLogPath();

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const allLines = content.split('\n');

    if (level === 'all') {
      return allLines.slice(-lines).join('\n');
    }

    // 筛选指定级别的日志
    const levelPatterns: Record<string, RegExp> = {
      error: /\[error\]/i,
      warn: /\[warn\]/i,
      info: /\[info\]/i,
      debug: /\[debug\]/i,
    };

    const pattern = levelPatterns[level];
    const filteredLines = allLines.filter((line) => pattern.test(line));
    return filteredLines.slice(-lines).join('\n');
  } catch (error) {
    return `无法读取日志: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}

/**
 * 搜索日志
 */
export async function searchLogs(keyword: string, lines: number = 500): Promise<string> {
  const logPath = getLogPath();

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const allLines = content.split('\n');

    if (!keyword.trim()) {
      return allLines.slice(-lines).join('\n');
    }

    const lowerKeyword = keyword.toLowerCase();
    const matchedLines = allLines.filter((line) => line.toLowerCase().includes(lowerKeyword));
    return matchedLines.slice(-lines).join('\n');
  } catch (error) {
    return `无法读取日志: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}

/**
 * 清理过期日志文件
 */
export async function cleanOldLogs(): Promise<number> {
  const logDir = getLogDir();
  const now = Date.now();
  const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const files = await fs.readdir(logDir);

    for (const file of files) {
      // 只处理 .log 和 .log.old 文件
      if (!file.endsWith('.log') && !file.endsWith('.log.old') && !file.match(/\.log\.\d+$/)) {
        continue;
      }

      const filePath = path.join(logDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
          log.info(`Deleted old log file: ${file}`);
        }
      } catch {
        // 忽略单个文件的错误
      }
    }
  } catch (error) {
    log.error('Failed to clean old logs:', error);
  }

  return deletedCount;
}

/**
 * 获取日志统计信息
 */
export async function getLogStats(): Promise<{
  totalSize: number;
  fileCount: number;
  oldestFile?: string;
  newestFile?: string;
}> {
  const logDir = getLogDir();
  let totalSize = 0;
  let fileCount = 0;
  let oldestTime = Infinity;
  let newestTime = 0;
  let oldestFile: string | undefined;
  let newestFile: string | undefined;

  try {
    const files = await fs.readdir(logDir);

    for (const file of files) {
      if (!file.endsWith('.log') && !file.endsWith('.log.old') && !file.match(/\.log\.\d+$/)) {
        continue;
      }

      const filePath = path.join(logDir, file);
      try {
        const stat = await fs.stat(filePath);
        totalSize += stat.size;
        fileCount++;

        if (stat.mtimeMs < oldestTime) {
          oldestTime = stat.mtimeMs;
          oldestFile = file;
        }
        if (stat.mtimeMs > newestTime) {
          newestTime = stat.mtimeMs;
          newestFile = file;
        }
      } catch {
        // 忽略
      }
    }
  } catch {
    // 忽略
  }

  return { totalSize, fileCount, oldestFile, newestFile };
}

// 启动时清理过期日志
cleanOldLogs().then((count) => {
  if (count > 0) {
    log.info(`Cleaned ${count} old log files`);
  }
});

// 导出 logger 实例
export default log;
