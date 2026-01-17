/**
 * 同步引擎
 * 核心同步逻辑：三方比较算法、增量同步
 *
 * 改进特性：
 * - manifest 写入失败自动重试和回滚
 * - 冲突时保留被覆盖版本备份
 * - 结构化同步日志
 * - 单个文件失败不影响整体同步
 */

import path from 'node:path';
import fsNode from 'node:fs/promises';
import type {
  LocalSyncState,
  RemoteSyncManifest,
  LocalFileInfo,
  RemoteFileMeta,
  FileDiff,
  ConflictStrategy,
  SyncProgress,
  SyncProgressCallback,
  SyncResult,
  SyncOptions,
  SyncError,
  SyncLogEntry,
} from './types';
import {
  scanLocalFiles,
  readLocalSyncState,
  writeLocalSyncState,
  createInitialSyncState,
  createInitialManifest,
  safeWriteFile,
  safeDeleteFile,
  isPathInSyncScope,
  ensureDir,
} from './syncUtils';
import { WebDAVSyncClient } from './webdavClient';

/**
 * 同步日志记录器
 */
class SyncLogger {
  private logs: SyncLogEntry[] = [];

  constructor(private appPath: string) {}

  log(
    level: SyncLogEntry['level'],
    action: string,
    message: string,
    filePath?: string,
    data?: Record<string, unknown>,
  ): void {
    const entry: SyncLogEntry = {
      timestamp: Date.now(),
      level,
      action,
      message,
      path: filePath,
      data,
    };
    this.logs.push(entry);

    // 也输出到控制台
    const prefix = `[Sync:${level.toUpperCase()}]`;
    const pathInfo = filePath ? ` [${filePath}]` : '';
    console.log(`${prefix}${pathInfo} ${action}: ${message}`);
  }

  info(action: string, message: string, filePath?: string, data?: Record<string, unknown>): void {
    this.log('info', action, message, filePath, data);
  }

  warn(action: string, message: string, filePath?: string, data?: Record<string, unknown>): void {
    this.log('warn', action, message, filePath, data);
  }

  error(action: string, message: string, filePath?: string, data?: Record<string, unknown>): void {
    this.log('error', action, message, filePath, data);
  }

  debug(action: string, message: string, filePath?: string, data?: Record<string, unknown>): void {
    this.log('debug', action, message, filePath, data);
  }

  getLogs(): SyncLogEntry[] {
    return [...this.logs];
  }

  /**
   * 保存日志到文件
   */
  async save(): Promise<void> {
    if (this.logs.length === 0) return;

    const logDir = path.join(this.appPath, 'sync-logs');
    await fsNode.mkdir(logDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `sync-${timestamp}.json`);

    await fsNode.writeFile(logFile, JSON.stringify(this.logs, null, 2), 'utf-8');

    // 只保留最近 10 个日志文件
    try {
      const files = await fsNode.readdir(logDir);
      const logFiles = files
        .filter((f: string) => f.startsWith('sync-') && f.endsWith('.json'))
        .sort();
      if (logFiles.length > 10) {
        for (const oldFile of logFiles.slice(0, logFiles.length - 10)) {
          await fsNode.unlink(path.join(logDir, oldFile));
        }
      }
    } catch {
      // 清理失败不影响主流程
    }
  }
}

/**
 * 同步引擎类
 */
export class SyncEngine {
  private webdavClient: WebDAVSyncClient;
  private storagePath: string;
  private appPath: string;
  private onProgress?: SyncProgressCallback;
  private logger: SyncLogger;

  constructor(webdavClient: WebDAVSyncClient, storagePath: string, appPath: string) {
    this.webdavClient = webdavClient;
    this.storagePath = storagePath;
    this.appPath = appPath;
    this.logger = new SyncLogger(appPath);
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: SyncProgressCallback): void {
    this.onProgress = callback;
  }

  /**
   * 报告进度
   */
  private reportProgress(progress: Partial<SyncProgress>): void {
    if (this.onProgress) {
      this.onProgress({
        stage: 'idle',
        percent: 0,
        processed: 0,
        total: 0,
        message: '',
        ...progress,
      });
    }
  }

  /**
   * 带重试的操作执行
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    filePath?: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          operationName,
          `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
          filePath,
        );

        if (attempt < maxRetries) {
          // 指数退避：1s, 2s, 4s...
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 执行完整同步
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    const conflictBackups: string[] = [];
    const conflictStrategy = options.conflictStrategy || 'newest';
    const maxRetries = options.maxRetries ?? 3;
    const keepConflictBackup = options.keepConflictBackup ?? true;

    // 创建新的日志实例
    this.logger = new SyncLogger(this.appPath);
    this.logger.info('sync', `开始同步，策略: ${conflictStrategy}`);

    let uploaded = 0;
    let downloaded = 0;
    let deleted = 0;
    let skipped = 0;
    let conflictsResolved = 0;

    try {
      // 1. 连接检查
      this.reportProgress({ stage: 'connecting', percent: 5, message: '正在连接服务器...' });
      await this.withRetry(
        () => this.webdavClient.ensureRemoteDirectories(),
        'ensureRemoteDirectories',
        maxRetries,
      );
      this.logger.info('connect', '服务器连接成功');

      // 3. 读取本地同步状态（提前读取，用于增量扫描）
      let localState = await readLocalSyncState(this.appPath);
      if (!localState) {
        localState = createInitialSyncState();
        this.logger.info('state', '创建初始同步状态');
      }

      // 2. 扫描本地文件（传入 localState 进行增量扫描）
      // 注意：这里顺序调整了，先读取状态再扫描文件
      this.reportProgress({ stage: 'scanning', percent: 10, message: '正在扫描本地文件...' });
      const localFiles = await scanLocalFiles(this.storagePath, localState);
      this.logger.info('scan', `扫描到 ${localFiles.length} 个本地文件`);

      // 4. 获取远程清单
      // 4. 获取远程清单 (带 ETag)
      this.reportProgress({ stage: 'comparing', percent: 20, message: '正在获取远程状态...' });

      const manifestResult = await this.withRetry(
        () => this.webdavClient.readManifestWithEtag(),
        'readManifest',
        maxRetries,
      );

      let remoteManifest = manifestResult.manifest;
      const manifestEtag = manifestResult.etag;

      if (!remoteManifest) {
        remoteManifest = createInitialManifest(localState.deviceId);
        this.logger.info('manifest', '创建初始远程清单');
      }

      // 5. 验证远程清单与实际文件的一致性
      this.reportProgress({ stage: 'comparing', percent: 25, message: '正在验证远程文件...' });
      remoteManifest = await this.validateRemoteManifest(remoteManifest);

      // 6. 计算差异
      this.reportProgress({ stage: 'comparing', percent: 30, message: '正在比较差异...' });
      const diffs = this.calculateDiffs(localFiles, localState, remoteManifest, conflictStrategy);

      const diffSummary = {
        upload: diffs.filter((d) => d.action === 'upload').length,
        download: diffs.filter((d) => d.action === 'download').length,
        'delete-remote': diffs.filter((d) => d.action === 'delete-remote').length,
        'delete-local': diffs.filter((d) => d.action === 'delete-local').length,
        conflict: diffs.filter((d) => d.action === 'conflict').length,
        skip: diffs.filter((d) => d.action === 'skip').length,
      };
      this.logger.info('diff', `差异计算完成`, undefined, diffSummary);

      if (options.dryRun) {
        this.logger.info('dryRun', '试运行完成，不执行实际操作');
        return {
          success: true,
          message: `试运行完成：${diffs.filter((d) => d.action !== 'skip').length} 个文件需要同步`,
          startTime,
          endTime: Date.now(),
          uploaded: diffSummary.upload,
          downloaded: diffSummary.download,
          deleted: diffSummary['delete-remote'] + diffSummary['delete-local'],
          skipped: diffSummary.skip,
          conflictsResolved: 0,
          errors: [],
        };
      }

      // 7. 执行同步操作
      const actionDiffs = diffs.filter((d) => d.action !== 'skip');
      const totalActions = actionDiffs.length;

      for (let i = 0; i < actionDiffs.length; i++) {
        const diff = actionDiffs[i];
        const percent = 40 + Math.floor((i / totalActions) * 50);

        try {
          switch (diff.action) {
            case 'upload':
              this.reportProgress({
                stage: 'uploading',
                percent,
                currentFile: diff.path,
                processed: i,
                total: totalActions,
                message: `正在上传: ${diff.path}`,
              });
              await this.withRetry(
                () => this.uploadFile(diff, remoteManifest, localState),
                'upload',
                maxRetries,
                diff.path,
              );
              this.logger.info('upload', '上传成功', diff.path);
              uploaded++;
              break;

            case 'download':
              this.reportProgress({
                stage: 'downloading',
                percent,
                currentFile: diff.path,
                processed: i,
                total: totalActions,
                message: `正在下载: ${diff.path}`,
              });
              await this.withRetry(
                () => this.downloadFile(diff, remoteManifest, localState),
                'download',
                maxRetries,
                diff.path,
              );
              this.logger.info('download', '下载成功', diff.path);
              downloaded++;
              break;

            case 'delete-remote':
              this.reportProgress({
                stage: 'uploading',
                percent,
                currentFile: diff.path,
                processed: i,
                total: totalActions,
                message: `正在删除远程: ${diff.path}`,
              });
              await this.withRetry(
                () => this.deleteRemoteFile(diff, remoteManifest, localState),
                'delete-remote',
                maxRetries,
                diff.path,
              );
              this.logger.info('delete-remote', '远程删除成功', diff.path);
              deleted++;
              break;

            case 'delete-local':
              this.reportProgress({
                stage: 'downloading',
                percent,
                currentFile: diff.path,
                processed: i,
                total: totalActions,
                message: `正在删除本地: ${diff.path}`,
              });
              await this.deleteLocalFile(diff, localState);
              this.logger.info('delete-local', '本地删除成功', diff.path);
              deleted++;
              break;

            case 'conflict':
              // 冲突处理：先备份被覆盖的版本
              if (keepConflictBackup && diff.local && diff.remote) {
                const backupPath = await this.backupConflictVersion(diff);
                if (backupPath) {
                  conflictBackups.push(backupPath);
                  this.logger.info('conflict-backup', `冲突备份已创建`, backupPath);
                }
              }

              if (diff.conflict?.resolution === 'keep-local') {
                await this.withRetry(
                  () => this.uploadFile(diff, remoteManifest, localState),
                  'conflict-upload',
                  maxRetries,
                  diff.path,
                );
                this.logger.info('conflict', `冲突解决：保留本地版本，上传覆盖远程`, diff.path);
                uploaded++;
              } else {
                await this.withRetry(
                  () => this.downloadFile(diff, remoteManifest, localState),
                  'conflict-download',
                  maxRetries,
                  diff.path,
                );
                this.logger.info('conflict', `冲突解决：保留远程版本，下载覆盖本地`, diff.path);
                downloaded++;
              }
              conflictsResolved++;
              break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          this.logger.error('sync-action', `处理失败: ${errorMessage}`, diff.path);
          errors.push({
            path: diff.path,
            code: 'SYNC_ERROR',
            message: errorMessage,
            retryable: true,
          });
        }
      }

      skipped = diffs.filter((d) => d.action === 'skip').length;

      // 8. 保存状态（带重试）
      this.reportProgress({ stage: 'finalizing', percent: 95, message: '正在保存状态...' });

      // 更新远程清单（带重试和回滚）
      remoteManifest.updatedAt = Date.now();
      remoteManifest.updatedBy = localState.deviceId;

      try {
        await this.withRetry(
          () => this.webdavClient.writeManifest(remoteManifest, { ifMatch: manifestEtag }),
          'writeManifest',
          maxRetries,
        );
        this.logger.info('manifest', '远程清单更新成功');
      } catch (manifestError) {
        // 处理 412 Precondition Failed (Etag 不匹配)
        if (
          manifestError instanceof Error &&
          (manifestError.message.includes('412') ||
            manifestError.message.includes('Precondition Failed'))
        ) {
          this.logger.warn('manifest', '远程清单在同步过程中已变更 (ETag mismatch)，建议重试');
          throw new Error('SYNC_CONFLICT_MANIFEST_CHANGED');
        }

        // manifest 写入失败是严重问题，但不应导致整个同步失败
        this.logger.error(
          'manifest',
          `远程清单写入失败: ${manifestError instanceof Error ? manifestError.message : '未知错误'}`,
        );
        errors.push({
          code: 'MANIFEST_WRITE_FAILED',
          message: '远程清单更新失败，下次同步可能需要重新计算差异',
          retryable: true,
        });
      }

      // 更新本地状态
      localState.lastSyncAt = Date.now();
      await writeLocalSyncState(this.appPath, localState);
      this.logger.info('state', '本地状态更新成功');

      // 保存同步日志
      await this.logger.save();

      this.reportProgress({ stage: 'done', percent: 100, message: '同步完成' });

      const resultMessage =
        errors.length > 0
          ? `同步完成，但有 ${errors.length} 个错误`
          : `同步成功：上传 ${uploaded}，下载 ${downloaded}，删除 ${deleted}，跳过 ${skipped}`;

      this.logger.info('complete', resultMessage, undefined, {
        uploaded,
        downloaded,
        deleted,
        skipped,
        conflictsResolved,
        conflictBackups: conflictBackups.length,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        message: resultMessage,
        startTime,
        endTime: Date.now(),
        uploaded,
        downloaded,
        deleted,
        skipped,
        conflictsResolved,
        conflictBackups: conflictBackups.length > 0 ? conflictBackups : undefined,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error('sync', `同步失败: ${errorMessage}`);

      // 如果是 manifest 并发冲突，尝试自动重试整个同步流程
      if (errorMessage === 'SYNC_CONFLICT_MANIFEST_CHANGED' && maxRetries > 0) {
        this.logger.warn('sync', '检测到 Manifest 并发冲突，正在重新开始同步...');
        // 建议前端/调用方处理重试，或者这里返回特定状态
        return {
          success: false,
          message: `同步冲突：远程状态已更新，请重试`,
          startTime,
          endTime: Date.now(),
          uploaded,
          downloaded,
          deleted,
          skipped,
          conflictsResolved,
          errors: [
            {
              code: 'SYNC_CONFLICT_RETRY_NEEDED',
              message: '远程状态已更新，请重试同步',
              retryable: true,
            },
          ],
        };
      }

      await this.logger.save();

      this.reportProgress({ stage: 'error', percent: 0, message: '同步失败' });

      return {
        success: false,
        message: `同步失败: ${errorMessage}`,
        startTime,
        endTime: Date.now(),
        uploaded,
        downloaded,
        deleted,
        skipped,
        conflictsResolved,
        errors: [
          {
            code: 'SYNC_FAILED',
            message: errorMessage,
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * 验证远程清单与实际文件的一致性
   * 防止 manifest 和实际文件不同步的问题
   */
  private async validateRemoteManifest(manifest: RemoteSyncManifest): Promise<RemoteSyncManifest> {
    const filesToCheck = Object.keys(manifest.files);
    if (filesToCheck.length === 0) return manifest;

    // 采样检查：最多检查 10 个文件的存在性
    const samplesToCheck = filesToCheck.slice(0, 10);
    const inconsistentFiles: string[] = [];

    for (const filePath of samplesToCheck) {
      try {
        const exists = await this.webdavClient.existsDataFile(filePath);
        if (!exists) {
          inconsistentFiles.push(filePath);
          this.logger.warn('validate', `远程文件不存在但 manifest 有记录`, filePath);
        }
      } catch {
        // 检查失败时不做处理
      }
    }

    // 如果发现不一致，从 manifest 中移除这些文件
    if (inconsistentFiles.length > 0) {
      this.logger.warn(
        'validate',
        `发现 ${inconsistentFiles.length} 个 manifest 不一致的文件，已自动修复`,
      );
      for (const filePath of inconsistentFiles) {
        delete manifest.files[filePath];
      }
    }

    return manifest;
  }

  /**
   * 备份冲突版本
   * 当冲突发生时，保存被覆盖的版本
   */
  private async backupConflictVersion(diff: FileDiff): Promise<string | null> {
    try {
      // 如果是保留远程版本，检查本地是否为出厂状态
      // 出厂状态的文件不需要备份（没有用户数据价值）
      if (diff.conflict?.resolution === 'keep-remote' && diff.local?.content) {
        if (this.isFactoryDefaultFolder(diff.local.content)) {
          this.logger.info('backup', '跳过出厂状态文件的备份', diff.path);
          return null;
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(diff.path);
      const base = path.basename(diff.path, ext);
      const dir = path.dirname(diff.path);

      // 备份文件名：original.conflict-2025-01-01T12-00-00.json
      const backupName = `${base}.conflict-${timestamp}${ext}`;
      const backupRelativePath = path.join(dir, backupName);
      const backupFullPath = path.join(this.storagePath, backupRelativePath);

      // 如果是保留本地版本（覆盖远程），备份远程版本
      // 如果是保留远程版本（覆盖本地），备份本地版本
      if (diff.conflict?.resolution === 'keep-local') {
        // 下载远程版本作为备份
        const remoteContent = await this.webdavClient.downloadDataFile(diff.path);
        await safeWriteFile(backupFullPath, remoteContent);
      } else {
        // 备份本地版本
        const localPath = path.join(this.storagePath, diff.path);
        const localContent = await fsNode.readFile(localPath, 'utf-8');
        await safeWriteFile(backupFullPath, localContent);
      }

      return backupRelativePath;
    } catch (error) {
      this.logger.warn(
        'backup',
        `冲突备份失败: ${error instanceof Error ? error.message : '未知错误'}`,
        diff.path,
      );
      return null;
    }
  }

  /**
   * 三方比较算法
   * 比较：本地当前状态 vs 上次同步状态 vs 远程状态
   *
   * 同步逻辑矩阵（Dropbox 风格双向同步）：
   * | 本地文件 | 远程文件 | 同步状态 | 动作 |
   * |---------|---------|---------|------|
   * | 有(无变化) | 有(无变化) | 有 | 跳过 |
   * | 有(改) | 有(无变化) | 有 | 上传 |
   * | 有(无变化) | 有(改) | 有 | 下载 |
   * | 有(改) | 有(改) | 有 | 冲突处理 |
   * | 有 | 无 | 有 | 远程已删除→删除本地 |
   * | 有 | 无 | 无 | 新文件→上传 |
   * | 无 | 有 | 有 | 本地已删除→删除远程 |
   * | 无 | 有 | 无 | 新文件→下载 |
   */
  private calculateDiffs(
    localFiles: LocalFileInfo[],
    localState: LocalSyncState,
    remoteManifest: RemoteSyncManifest,
    conflictStrategy: ConflictStrategy,
  ): FileDiff[] {
    const diffs: FileDiff[] = [];
    const processedPaths = new Set<string>();

    // 创建本地文件映射
    const localFilesMap = new Map<string, LocalFileInfo>();
    for (const file of localFiles) {
      localFilesMap.set(file.path, file);
    }

    // 1. 遍历本地文件
    for (const localFile of localFiles) {
      const { path: filePath } = localFile;
      processedPaths.add(filePath);

      const syncedState = localState.files[filePath];
      const remoteFile = remoteManifest.files[filePath];

      // 场景：本地有文件，远程没有
      if (!remoteFile) {
        if (syncedState) {
          // 之前同步过，远程没有了 → 远程已删除，删除本地
          diffs.push({ path: filePath, action: 'delete-local', local: localFile });
        } else {
          // 从未同步过，远程没有 → 新文件，上传
          diffs.push({ path: filePath, action: 'upload', local: localFile });
        }
        continue;
      }

      // 场景：本地有文件，远程也有文件
      // 判断本地是否有变化（与上次同步相比）
      const localChanged = !syncedState || syncedState.syncedHash !== localFile.hash;
      // 判断远程是否有变化（与上次同步相比）
      const remoteChanged = !syncedState || remoteFile.hash !== syncedState.syncedHash;

      if (!localChanged && !remoteChanged) {
        // 无变化
        diffs.push({ path: filePath, action: 'skip', local: localFile, remote: remoteFile });
      } else if (localChanged && !remoteChanged) {
        // 只有本地变化 -> 上传
        diffs.push({ path: filePath, action: 'upload', local: localFile, remote: remoteFile });
      } else if (!localChanged && remoteChanged) {
        // 只有远程变化 -> 下载
        diffs.push({ path: filePath, action: 'download', local: localFile, remote: remoteFile });
      } else {
        // 双方都有变化 -> 冲突
        const resolution = this.resolveConflict(localFile, remoteFile, conflictStrategy);
        diffs.push({
          path: filePath,
          action: 'conflict',
          local: localFile,
          remote: remoteFile,
          conflict: {
            path: filePath,
            localModifiedAt: localFile.modifiedAt,
            localHash: localFile.hash,
            remoteModifiedAt: remoteFile.modifiedAt,
            remoteHash: remoteFile.hash,
            resolution,
          },
        });
      }
    }

    // 2. 检查远程有但本地没有的文件（需要下载或本地已删除）
    for (const [filePath, remoteFile] of Object.entries(remoteManifest.files)) {
      if (processedPaths.has(filePath)) continue;
      if (!isPathInSyncScope(filePath)) continue;

      // 标记为已处理：避免后续第 3 步（基于 localState 扫描）对同一路径重复生成 diff
      processedPaths.add(filePath);

      const syncedState = localState.files[filePath];

      if (syncedState) {
        // 之前同步过，现在本地没有 -> 本地删除了，需要删除远程
        diffs.push({ path: filePath, action: 'delete-remote', remote: remoteFile });
      } else {
        // 从未同步过，远程有 -> 需要下载
        diffs.push({ path: filePath, action: 'download', remote: remoteFile });
      }
    }

    // 3. 检查本地同步状态中有但本地和远程都没有的文件（已删除）
    for (const filePath of Object.keys(localState.files)) {
      if (processedPaths.has(filePath)) continue;
      if (!isPathInSyncScope(filePath)) continue;

      const remoteFile = remoteManifest.files[filePath];
      if (remoteFile) {
        // 远程还有，本地删除了 -> 删除远程
        diffs.push({ path: filePath, action: 'delete-remote', remote: remoteFile });
      }
      // 如果远程也没有，就不需要任何操作
    }

    return diffs;
  }

  /**
   * 检查文件夹是否为"出厂初始状态"
   * 用于智能解决全新安装时的默认文件夹冲突
   */
  private isFactoryDefaultFolder(content: string): boolean {
    try {
      const data = JSON.parse(content);
      // 检查是否符合出厂默认文件夹的所有特征
      return (
        data.id === 'default' &&
        data.name === '默认文件夹' &&
        data.system === true &&
        data.order === 0 &&
        // 确保只有标准的 6 个字段，没有用户自定义的额外字段
        Object.keys(data).length === 6
      );
    } catch {
      return false;
    }
  }

  /**
   * 解决冲突
   * 智能策略：
   * 1. 对于出厂初始状态的文件夹，优先保留云端版本（避免全新安装产生无意义冲突）
   * 2. 对于用户修改过的文件，按策略处理
   */
  private resolveConflict(
    local: LocalFileInfo,
    remote: RemoteFileMeta,
    strategy: ConflictStrategy,
  ): 'keep-local' | 'keep-remote' {
    // 智能检测：对于 folders/default.json，检查本地是否为出厂初始状态
    if (local.path === 'folders/default.json' && local.content) {
      if (this.isFactoryDefaultFolder(local.content)) {
        this.logger.info(
          'conflict',
          '检测到本地为出厂初始状态的默认文件夹，优先使用云端版本',
          local.path,
        );
        return 'keep-remote';
      }
    }

    switch (strategy) {
      case 'local':
        return 'keep-local';
      case 'remote':
        return 'keep-remote';
      case 'newest':
      default:
        // 比较修改时间，保留较新的
        return local.modifiedAt >= remote.modifiedAt ? 'keep-local' : 'keep-remote';
    }
  }

  /**
   * 上传文件
   */
  private async uploadFile(
    diff: FileDiff,
    manifest: RemoteSyncManifest,
    localState: LocalSyncState,
  ): Promise<void> {
    const local = diff.local!;

    // 根据文件类型选择上传方式
    if (local.isBinary) {
      // 二进制文件：从磁盘读取后上传
      const localPath = path.join(this.storagePath, diff.path);
      const buffer = await fsNode.readFile(localPath);
      await this.webdavClient.uploadDataFileBinary(diff.path, buffer);
    } else {
      // 文本文件：直接使用已读取的内容
      await this.webdavClient.uploadDataFile(diff.path, local.content!);
    }

    // 更新远程清单
    manifest.files[diff.path] = {
      hash: local.hash,
      modifiedAt: local.modifiedAt,
      size: local.size,
      updatedBy: localState.deviceId,
    };

    // 更新本地同步状态
    localState.files[diff.path] = {
      syncedHash: local.hash,
      syncedAt: Date.now(),
      localModifiedAt: local.modifiedAt, // 记录 mtime，用于增量扫描
    };

    console.log(`[Sync] Uploaded: ${diff.path}${local.isBinary ? ' (binary)' : ''}`);
  }

  /**
   * 下载文件
   */
  private async downloadFile(
    diff: FileDiff,
    _manifest: RemoteSyncManifest,
    localState: LocalSyncState,
  ): Promise<void> {
    const remote = diff.remote!;
    const localPath = path.join(this.storagePath, diff.path);

    // 检查是否为二进制文件（根据路径判断）
    const isBinary = !diff.path.endsWith('.json');

    if (isBinary) {
      // 二进制文件：下载并保存为 Buffer
      const buffer = await this.webdavClient.downloadDataFileBinary(diff.path);
      await ensureDir(path.dirname(localPath));
      await fsNode.writeFile(localPath, buffer);
    } else {
      // 文本文件：下载并保存为字符串
      const content = await this.webdavClient.downloadDataFile(diff.path);
      await safeWriteFile(localPath, content);
    }

    // 更新本地同步状态
    localState.files[diff.path] = {
      syncedHash: remote.hash,
      syncedAt: Date.now(),
      // 对于下载的文件，我们需要获取本地文件的实际 mtime
      localModifiedAt: (await fsNode.stat(localPath)).mtimeMs,
    };

    console.log(`[Sync] Downloaded: ${diff.path}${isBinary ? ' (binary)' : ''}`);
  }

  /**
   * 删除远程文件
   */
  private async deleteRemoteFile(
    diff: FileDiff,
    manifest: RemoteSyncManifest,
    localState: LocalSyncState,
  ): Promise<void> {
    // 从远程删除
    await this.webdavClient.deleteDataFile(diff.path);

    // 从远程清单移除
    delete manifest.files[diff.path];

    // 从本地状态移除
    delete localState.files[diff.path];

    console.log(`[Sync] Deleted remote: ${diff.path}`);
  }

  /**
   * 删除本地文件
   */
  private async deleteLocalFile(diff: FileDiff, localState: LocalSyncState): Promise<void> {
    const localPath = path.join(this.storagePath, diff.path);

    // 删除本地文件
    await safeDeleteFile(localPath);

    // 从本地状态移除
    delete localState.files[diff.path];

    console.log(`[Sync] Deleted local: ${diff.path}`);
  }

  /**
   * 获取同步状态预览（不执行同步）
   */
  async preview(): Promise<{
    toUpload: string[];
    toDownload: string[];
    toDeleteRemote: string[];
    toDeleteLocal: string[];
    conflicts: string[];
    unchanged: number;
  }> {
    const uniq = (paths: string[]) => Array.from(new Set(paths));

    const localFiles = await scanLocalFiles(this.storagePath);

    let localState = await readLocalSyncState(this.appPath);
    if (!localState) {
      localState = createInitialSyncState();
    }

    let remoteManifest = await this.webdavClient.readManifest();
    if (!remoteManifest) {
      remoteManifest = createInitialManifest(localState.deviceId);
    }

    const diffs = this.calculateDiffs(localFiles, localState, remoteManifest, 'newest');

    return {
      toUpload: uniq(diffs.filter((d) => d.action === 'upload').map((d) => d.path)),
      toDownload: uniq(diffs.filter((d) => d.action === 'download').map((d) => d.path)),
      toDeleteRemote: uniq(diffs.filter((d) => d.action === 'delete-remote').map((d) => d.path)),
      toDeleteLocal: uniq(diffs.filter((d) => d.action === 'delete-local').map((d) => d.path)),
      conflicts: uniq(diffs.filter((d) => d.action === 'conflict').map((d) => d.path)),
      unchanged: diffs.filter((d) => d.action === 'skip').length,
    };
  }
}
