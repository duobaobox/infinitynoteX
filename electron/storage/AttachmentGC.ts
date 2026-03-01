/**
 * 附件垃圾回收器
 *
 * 负责：扫描孤立附件（未被任何便签引用）并删除，释放磁盘空间
 */

import type { NoteStorage } from './NoteStorage';
import type { TrashStorage } from './TrashStorage';
import type { AttachmentStorage } from './AttachmentStorage';

export class AttachmentGC {
  constructor(
    private notes: NoteStorage,
    private trash: TrashStorage,
    private attachments: AttachmentStorage,
  ) {}

  /**
   * 清理孤立附件
   * 扫描所有便签和回收站中的 attachment:// 引用，删除未被引用的附件文件
   */
  async cleanupOrphanedAttachments(): Promise<{
    deleted: number;
    freedBytes: number;
    errors: string[];
  }> {
    console.log('[AttachmentGC] Starting attachment garbage collection...');
    const errors: string[] = [];

    try {
      // 1. 收集所有被引用的附件 ID
      const usedIds = new Set<string>();

      const noteIndex = await this.notes.list();
      for (const idx of noteIndex) {
        try {
          const note = await this.notes.get(idx.id);
          this.extractAttachmentIds(note.content, usedIds);
        } catch {
          errors.push(`Failed to scan note ${idx.id}`);
        }
      }

      const trashIndex = await this.trash.list();
      for (const idx of trashIndex) {
        try {
          const item = await this.trash.get(idx.id);
          this.extractAttachmentIds(item.content, usedIds);
        } catch {
          errors.push(`Failed to scan trash item ${idx.id}`);
        }
      }

      console.log(`[AttachmentGC] Found ${usedIds.size} referenced attachments`);

      // 2. 找出孤立附件
      const allAttachments = await this.attachments.list();
      console.log(`[AttachmentGC] Found ${allAttachments.length} total attachments`);

      const orphaned = allAttachments.filter((att) => !usedIds.has(att.id));
      if (orphaned.length === 0) {
        console.log('[AttachmentGC] No orphaned attachments found');
        return { deleted: 0, freedBytes: 0, errors };
      }

      // 3. 删除孤立附件
      let deleted = 0;
      let freedBytes = 0;

      for (const attachment of orphaned) {
        try {
          await this.attachments.delete(attachment.id);
          deleted++;
          freedBytes += attachment.size;
          console.log(`[AttachmentGC] Deleted orphaned attachment: ${attachment.id}`);
        } catch {
          errors.push(`Failed to delete attachment ${attachment.id}`);
        }
      }

      console.log(
        `[AttachmentGC] GC completed: ${deleted} files deleted, ` +
          `${(freedBytes / 1024 / 1024).toFixed(2)} MB freed`,
      );
      return { deleted, freedBytes, errors };
    } catch (error) {
      console.error('[AttachmentGC] GC failed:', error);
      errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { deleted: 0, freedBytes: 0, errors };
    }
  }

  // ============ 私有工具 ============

  /**
   * 从 TipTap JSON 内容中提取 attachment:// 引用的 ID
   */
  private extractAttachmentIds(content: unknown, ids: Set<string>): void {
    if (!content || typeof content !== 'object') return;

    const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

    const traverse = (node: unknown) => {
      if (!isObj(node)) return;

      if (node.type === 'image' && isObj(node.attrs)) {
        const src = (node.attrs as Record<string, unknown>).src;
        if (typeof src === 'string' && src.startsWith('attachment://')) {
          ids.add(src.replace('attachment://', ''));
        }
      }

      if (Array.isArray(node.content)) {
        for (const child of node.content) traverse(child);
      }
    };

    traverse(content);
  }
}
