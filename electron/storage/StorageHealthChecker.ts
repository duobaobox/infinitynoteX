/**
 * 存储健康检查器
 *
 * 负责：健康检查、存储统计、启动完整性校验
 */

import { shell } from 'electron';

import type { StorageContext } from './StorageContext';
import type { FolderStorage } from './FolderStorage';
import type { NoteStorage } from './NoteStorage';
import type { AIStorage } from './AIStorage';
import type { StorageInitializer } from './StorageInitializer';
import type { HealthCheckResult, StorageStats } from './types';
import { validateStorageIntegrity, calculateDirectorySize } from './utils';

export class StorageHealthChecker {
  constructor(
    private context: StorageContext,
    private initializer: StorageInitializer,
    private folders: FolderStorage,
    private notes: NoteStorage,
    private ai: AIStorage,
  ) {}

  // ============ 健康检查 ============

  /**
   * 检查存储目录完整性
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await validateStorageIntegrity(this.context.dataDir);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 在 Finder / Explorer 中打开数据目录
   */
  async openInFinder(): Promise<void> {
    await shell.openPath(this.context.dataDir);
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    const dataSize = await calculateDirectorySize(this.context.dataDir);
    return {
      folderCount: this.folders.getCacheCount(),
      noteCount: this.notes.getCacheCount(),
      dataSize,
    };
  }

  // ============ 启动完整性校验 ============

  /**
   * 启动时完整性校验（非干净退出时执行全量校验）
   */
  async performStartupChecks(): Promise<void> {
    try {
      console.log('[StorageHealth] Performing startup integrity checks...');

      if (this.initializer.wasCleanExit) {
        console.log('[StorageHealth] Clean exit detected, skipping extensive integrity checks.');
        return;
      }

      console.warn(
        '[StorageHealth] Unclean exit detected or first run, performing full integrity checks...',
      );

      const noteIssues = await this.validateNotesIntegrity();
      if (noteIssues.length > 0) {
        console.warn(`[StorageHealth] Found ${noteIssues.length} note index issues, rebuilding...`);
        await this.notes.rebuildIndex();
      }

      const aiIssues = await this.validateAIConversationsIntegrity();
      if (aiIssues.length > 0) {
        console.warn(
          `[StorageHealth] Found ${aiIssues.length} AI conversation issues, rebuilding...`,
        );
        await this.ai.rebuildIndex();
      }

      console.log('[StorageHealth] Startup checks completed successfully');
    } catch (error) {
      console.error('[StorageHealth] Startup checks failed:', error);
    }
  }

  // ============ 私有校验方法 ============

  private async validateNotesIntegrity(): Promise<string[]> {
    const issues: string[] = [];
    const index = await this.notes.list();

    for (const item of index) {
      try {
        const note = await this.notes.get(item.id);
        if (note.title !== item.title) issues.push(`Note ${item.id}: title mismatch`);
        if (note.updatedAt !== item.updatedAt) issues.push(`Note ${item.id}: timestamp mismatch`);
        if (note.pinned !== item.pinned) issues.push(`Note ${item.id}: pinned mismatch`);
      } catch {
        issues.push(`Note ${item.id}: file missing or corrupted`);
      }
    }

    return issues;
  }

  private async validateAIConversationsIntegrity(): Promise<string[]> {
    const issues: string[] = [];
    const index = await this.ai.getIndex();

    for (const item of index) {
      try {
        const conversation = await this.ai.get(item.id);
        if (conversation.title !== item.title)
          issues.push(`Conversation ${item.id}: title mismatch`);
        if (conversation.updatedAt !== item.updatedAt)
          issues.push(`Conversation ${item.id}: timestamp mismatch`);
      } catch {
        issues.push(`Conversation ${item.id}: file missing or corrupted`);
      }
    }

    return issues;
  }
}
