/**
 * 同步引擎
 * 核心同步逻辑：三方比较算法、增量同步
 */

import path from 'node:path';
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
} from './syncUtils';
import { WebDAVSyncClient } from './webdavClient';

/**
 * 同步引擎类
 */
export class SyncEngine {
  private webdavClient: WebDAVSyncClient;
  private storagePath: string;
  private onProgress?: SyncProgressCallback;

  constructor(webdavClient: WebDAVSyncClient, storagePath: string) {
    this.webdavClient = webdavClient;
    this.storagePath = storagePath;
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
   * 执行完整同步
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    const conflictStrategy = options.conflictStrategy || 'newest';

    let uploaded = 0;
    let downloaded = 0;
    let deleted = 0;
    let skipped = 0;
    let conflictsResolved = 0;

    try {
      // 1. 连接检查
      this.reportProgress({ stage: 'connecting', percent: 5, message: '正在连接服务器...' });
      await this.webdavClient.ensureRemoteDirectories();

      // 2. 扫描本地文件
      this.reportProgress({ stage: 'scanning', percent: 10, message: '正在扫描本地文件...' });
      const localFiles = await scanLocalFiles(this.storagePath);
      console.log(`[Sync] Scanned ${localFiles.length} local files`);

      // 3. 读取本地同步状态
      let localState = await readLocalSyncState(this.storagePath);
      if (!localState) {
        localState = createInitialSyncState();
        console.log('[Sync] Created initial sync state');
      }

      // 4. 获取远程清单
      this.reportProgress({ stage: 'comparing', percent: 20, message: '正在获取远程状态...' });
      let remoteManifest = await this.webdavClient.readManifest();
      if (!remoteManifest) {
        remoteManifest = createInitialManifest(localState.deviceId);
        console.log('[Sync] Created initial remote manifest');
      }

      // 5. 计算差异
      this.reportProgress({ stage: 'comparing', percent: 30, message: '正在比较差异...' });
      const diffs = this.calculateDiffs(localFiles, localState, remoteManifest, conflictStrategy);
      console.log(`[Sync] Calculated diffs:`, {
        upload: diffs.filter((d) => d.action === 'upload').length,
        download: diffs.filter((d) => d.action === 'download').length,
        'delete-remote': diffs.filter((d) => d.action === 'delete-remote').length,
        'delete-local': diffs.filter((d) => d.action === 'delete-local').length,
        skip: diffs.filter((d) => d.action === 'skip').length,
      });

      if (options.dryRun) {
        return {
          success: true,
          message: `试运行完成：${diffs.filter((d) => d.action !== 'skip').length} 个文件需要同步`,
          startTime,
          endTime: Date.now(),
          uploaded: diffs.filter((d) => d.action === 'upload').length,
          downloaded: diffs.filter((d) => d.action === 'download').length,
          deleted: diffs.filter((d) => d.action === 'delete-remote' || d.action === 'delete-local')
            .length,
          skipped: diffs.filter((d) => d.action === 'skip').length,
          conflictsResolved: 0,
          errors: [],
        };
      }

      // 6. 执行同步操作
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
              await this.uploadFile(diff, remoteManifest, localState);
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
              await this.downloadFile(diff, remoteManifest, localState);
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
              await this.deleteRemoteFile(diff, remoteManifest, localState);
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
              deleted++;
              break;

            case 'conflict':
              // 冲突已在 calculateDiffs 中根据策略解决
              if (diff.conflict?.resolution === 'keep-local') {
                await this.uploadFile(diff, remoteManifest, localState);
                uploaded++;
              } else {
                await this.downloadFile(diff, remoteManifest, localState);
                downloaded++;
              }
              conflictsResolved++;
              break;
          }
        } catch (error) {
          console.error(`[Sync] Failed to process ${diff.path}:`, error);
          errors.push({
            path: diff.path,
            code: 'SYNC_ERROR',
            message: error instanceof Error ? error.message : '未知错误',
          });
        }
      }

      skipped = diffs.filter((d) => d.action === 'skip').length;

      // 7. 保存状态
      this.reportProgress({ stage: 'finalizing', percent: 95, message: '正在保存状态...' });

      // 更新远程清单
      remoteManifest.updatedAt = Date.now();
      remoteManifest.updatedBy = localState.deviceId;
      await this.webdavClient.writeManifest(remoteManifest);

      // 更新本地状态
      localState.lastSyncAt = Date.now();
      await writeLocalSyncState(this.storagePath, localState);

      this.reportProgress({ stage: 'done', percent: 100, message: '同步完成' });

      return {
        success: errors.length === 0,
        message:
          errors.length > 0
            ? `同步完成，但有 ${errors.length} 个错误`
            : `同步成功：上传 ${uploaded}，下载 ${downloaded}，删除 ${deleted}，跳过 ${skipped}`,
        startTime,
        endTime: Date.now(),
        uploaded,
        downloaded,
        deleted,
        skipped,
        conflictsResolved,
        errors,
      };
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      this.reportProgress({ stage: 'error', percent: 0, message: '同步失败' });

      return {
        success: false,
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
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
            message: error instanceof Error ? error.message : '未知错误',
          },
        ],
      };
    }
  }

  /**
   * 三方比较算法
   * 比较：本地当前状态 vs 上次同步状态 vs 远程状态
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

      // 判断本地是否有变化（与上次同步相比）
      const localChanged = !syncedState || syncedState.syncedHash !== localFile.hash;
      // 判断远程是否有变化（与上次同步相比）
      const remoteChanged = !syncedState
        ? !!remoteFile // 首次同步，远程有文件就算变化
        : remoteFile && remoteFile.hash !== syncedState.syncedHash;

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
        const resolution = this.resolveConflict(localFile, remoteFile!, conflictStrategy);
        diffs.push({
          path: filePath,
          action: 'conflict',
          local: localFile,
          remote: remoteFile,
          conflict: {
            path: filePath,
            localModifiedAt: localFile.modifiedAt,
            localHash: localFile.hash,
            remoteModifiedAt: remoteFile!.modifiedAt,
            remoteHash: remoteFile!.hash,
            resolution,
          },
        });
      }
    }

    // 2. 检查远程有但本地没有的文件（需要下载或本地已删除）
    for (const [filePath, remoteFile] of Object.entries(remoteManifest.files)) {
      if (processedPaths.has(filePath)) continue;
      if (!isPathInSyncScope(filePath)) continue;

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
   * 解决冲突
   */
  private resolveConflict(
    local: LocalFileInfo,
    remote: RemoteFileMeta,
    strategy: ConflictStrategy,
  ): 'keep-local' | 'keep-remote' {
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

    // 上传到远程
    await this.webdavClient.uploadDataFile(diff.path, local.content);

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
    };

    console.log(`[Sync] Uploaded: ${diff.path}`);
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

    // 从远程下载
    const content = await this.webdavClient.downloadDataFile(diff.path);

    // 保存到本地
    const localPath = path.join(this.storagePath, diff.path);
    await safeWriteFile(localPath, content);

    // 更新本地同步状态
    localState.files[diff.path] = {
      syncedHash: remote.hash,
      syncedAt: Date.now(),
    };

    console.log(`[Sync] Downloaded: ${diff.path}`);
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
    const localFiles = await scanLocalFiles(this.storagePath);

    let localState = await readLocalSyncState(this.storagePath);
    if (!localState) {
      localState = createInitialSyncState();
    }

    let remoteManifest = await this.webdavClient.readManifest();
    if (!remoteManifest) {
      remoteManifest = createInitialManifest(localState.deviceId);
    }

    const diffs = this.calculateDiffs(localFiles, localState, remoteManifest, 'newest');

    return {
      toUpload: diffs.filter((d) => d.action === 'upload').map((d) => d.path),
      toDownload: diffs.filter((d) => d.action === 'download').map((d) => d.path),
      toDeleteRemote: diffs.filter((d) => d.action === 'delete-remote').map((d) => d.path),
      toDeleteLocal: diffs.filter((d) => d.action === 'delete-local').map((d) => d.path),
      conflicts: diffs.filter((d) => d.action === 'conflict').map((d) => d.path),
      unchanged: diffs.filter((d) => d.action === 'skip').length,
    };
  }
}
