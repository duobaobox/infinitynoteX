/**
 * SQLite-vec 向量存储实现
 * 使用 better-sqlite3 + sqlite-vec 实现高性能向量检索
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import type {
  IVectorStore,
  VectorMetadata,
  SearchResult,
  VectorStoreStats,
  ChunkInfo,
  NoteIndexInfo,
} from './types';

// 重新导出类型供外部使用
export type { VectorMetadata, SearchResult, VectorStoreStats } from './types';

/**
 * SQLite-vec 向量存储实现
 * 实现 IVectorStore 接口
 */
export class SqliteVectorStore implements IVectorStore {
  private db: Database.Database;
  private dbPath: string;
  private dimension: number;
  private initialized: boolean = false;
  private autoDetectDimension: boolean;

  constructor(dbPath?: string, dimension?: number) {
    this.dbPath = dbPath || path.join(app.getPath('userData'), 'knowledge.db');
    this.db = new Database(this.dbPath);
    // 如果未指定维度，启用自动检测模式
    this.autoDetectDimension = dimension === undefined;
    this.dimension = dimension || 0; // 0 表示待检测
  }

  /**
   * 初始化数据库（创建表、加载扩展）
   */
  initialize(): void {
    if (this.initialized) return;

    // 加载 sqlite-vec 扩展
    sqliteVec.load(this.db);

    // 启用 WAL 模式提升并发性能
    this.db.pragma('journal_mode = WAL');

    // 创建元数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_metadata (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        note_title TEXT,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunk_note_id ON chunk_metadata(note_id);
    `);

    // 创建配置表用于存储维度信息
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS store_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 尝试读取已保存的维度
    const savedDimension = this.db
      .prepare('SELECT value FROM store_config WHERE key = ?')
      .get('dimension') as { value: string } | undefined;

    if (savedDimension) {
      this.dimension = parseInt(savedDimension.value, 10);
      this.autoDetectDimension = false;
      console.log('[VectorStore] Loaded saved dimension:', this.dimension);
    }

    // 如果有维度，创建向量表
    if (this.dimension > 0) {
      this.createVectorTable();
    } else {
      console.log('[VectorStore] Waiting for dimension auto-detection on first insert');
    }

    this.initialized = true;
  }

  /**
   * 创建向量虚拟表
   */
  private createVectorTable(): void {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[${this.dimension}]
      );
    `);
    console.log('[VectorStore] Vector table created with dimension:', this.dimension);
  }

  /**
   * 设置维度并创建表（首次插入时调用）
   */
  private setDimensionAndCreateTable(dimension: number): void {
    if (this.dimension > 0) return;

    this.dimension = dimension;
    this.autoDetectDimension = false;

    // 保存维度到配置表
    this.db
      .prepare('INSERT OR REPLACE INTO store_config(key, value) VALUES (?, ?)')
      .run('dimension', String(dimension));

    // 创建向量表
    this.createVectorTable();
    console.log('[VectorStore] Auto-detected dimension:', dimension);
  }

  /**
   * 插入或更新单个向量
   */
  upsert(id: string, embedding: number[], metadata: VectorMetadata): void {
    // 首次插入时自动检测维度
    if (this.autoDetectDimension && this.dimension === 0 && embedding.length > 0) {
      this.setDimensionAndCreateTable(embedding.length);
    }

    const now = Date.now();

    const transaction = this.db.transaction(() => {
      // 先删除旧数据
      this.db.prepare('DELETE FROM vec_chunks WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM chunk_metadata WHERE id = ?').run(id);

      // 插入新向量
      const float32 = new Float32Array(embedding);
      this.db
        .prepare('INSERT INTO vec_chunks(id, embedding) VALUES (?, ?)')
        .run(id, Buffer.from(float32.buffer));

      // 插入新元数据
      this.db
        .prepare(
          `INSERT INTO chunk_metadata(id, note_id, note_title, chunk_index, content, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(id, metadata.noteId, metadata.noteTitle, metadata.chunkIndex, metadata.content, now);
    });

    transaction();
  }

  /**
   * 批量插入向量（高效事务处理）
   */
  upsertBatch(items: Array<{ id: string; embedding: number[]; metadata: VectorMetadata }>): void {
    if (items.length === 0) return;

    // 首次插入时自动检测维度
    if (this.autoDetectDimension && this.dimension === 0 && items[0].embedding.length > 0) {
      this.setDimensionAndCreateTable(items[0].embedding.length);
    }

    const now = Date.now();

    const deleteVec = this.db.prepare('DELETE FROM vec_chunks WHERE id = ?');
    const deleteMeta = this.db.prepare('DELETE FROM chunk_metadata WHERE id = ?');
    const insertVec = this.db.prepare('INSERT INTO vec_chunks(id, embedding) VALUES (?, ?)');
    const insertMeta = this.db.prepare(
      `INSERT INTO chunk_metadata(id, note_id, note_title, chunk_index, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const transaction = this.db.transaction(() => {
      for (const item of items) {
        // 删除旧数据
        deleteVec.run(item.id);
        deleteMeta.run(item.id);

        // 插入新数据
        const float32 = new Float32Array(item.embedding);
        insertVec.run(item.id, Buffer.from(float32.buffer));
        insertMeta.run(
          item.id,
          item.metadata.noteId,
          item.metadata.noteTitle,
          item.metadata.chunkIndex,
          item.metadata.content,
          now,
        );
      }
    });

    transaction();
    console.log(`[VectorStore] Batch upserted ${items.length} vectors`);
  }

  /**
   * 删除某个笔记的所有向量
   */
  deleteByNoteId(noteId: string): number {
    const ids = this.db.prepare('SELECT id FROM chunk_metadata WHERE note_id = ?').all(noteId) as {
      id: string;
    }[];

    if (ids.length === 0) return 0;

    const transaction = this.db.transaction(() => {
      for (const { id } of ids) {
        this.db.prepare('DELETE FROM vec_chunks WHERE id = ?').run(id);
        this.db.prepare('DELETE FROM chunk_metadata WHERE id = ?').run(id);
      }
    });

    transaction();
    console.log(`[VectorStore] Deleted ${ids.length} vectors for note ${noteId}`);
    return ids.length;
  }

  /**
   * 向量相似度搜索
   */
  search(queryEmbedding: number[], topK: number = 3): SearchResult[] {
    // 如果向量表还未创建，返回空结果
    if (this.dimension === 0) {
      console.warn('[VectorStore] Vector table not yet created, cannot search');
      return [];
    }

    const float32 = new Float32Array(queryEmbedding);
    // sqlite-vec KNN 查询需要使用 k = ? 参数，不能用 LIMIT
    const results = this.db
      .prepare(
        `SELECT v.id, v.distance, m.note_id, m.note_title, m.content
         FROM vec_chunks v
         JOIN chunk_metadata m ON v.id = m.id
         WHERE v.embedding MATCH ? AND k = ?
         ORDER BY v.distance`,
      )
      .all(Buffer.from(float32.buffer), topK) as Array<{
      id: string;
      distance: number;
      note_id: string;
      note_title: string;
      content: string;
    }>;

    return results.map((r) => ({
      id: r.id,
      noteId: r.note_id,
      noteTitle: r.note_title,
      content: r.content,
      distance: r.distance,
      score: 1 / (1 + r.distance), // 将距离转换为相似度分数
    }));
  }

  /**
   * 获取统计信息
   */
  getStats(): VectorStoreStats {
    const vectorCount = this.db.prepare('SELECT COUNT(*) as count FROM chunk_metadata').get() as {
      count: number;
    };
    const noteCount = this.db
      .prepare('SELECT COUNT(DISTINCT note_id) as count FROM chunk_metadata')
      .get() as { count: number };

    return {
      totalVectors: vectorCount.count,
      uniqueNotes: noteCount.count,
    };
  }

  /**
   * 获取数据块列表（分页）
   */
  getChunks(options: { noteId?: string; offset?: number; limit?: number }): {
    chunks: ChunkInfo[];
    total: number;
  } {
    const { noteId, offset = 0, limit = 20 } = options;

    // 获取总数
    const countQuery = noteId
      ? this.db.prepare('SELECT COUNT(*) as count FROM chunk_metadata WHERE note_id = ?')
      : this.db.prepare('SELECT COUNT(*) as count FROM chunk_metadata');
    const countResult = (noteId ? countQuery.get(noteId) : countQuery.get()) as { count: number };

    // 获取分页数据
    const dataQuery = noteId
      ? this.db.prepare(`
          SELECT id, note_id, note_title, chunk_index, content, created_at
          FROM chunk_metadata
          WHERE note_id = ?
          ORDER BY note_id, chunk_index
          LIMIT ? OFFSET ?
        `)
      : this.db.prepare(`
          SELECT id, note_id, note_title, chunk_index, content, created_at
          FROM chunk_metadata
          ORDER BY note_id, chunk_index
          LIMIT ? OFFSET ?
        `);

    const rows = (
      noteId ? dataQuery.all(noteId, limit, offset) : dataQuery.all(limit, offset)
    ) as Array<{
      id: string;
      note_id: string;
      note_title: string;
      chunk_index: number;
      content: string;
      created_at: number;
    }>;

    return {
      chunks: rows.map((row) => ({
        id: row.id,
        noteId: row.note_id,
        noteTitle: row.note_title,
        chunkIndex: row.chunk_index,
        content: row.content,
        dimension: this.dimension,
        createdAt: row.created_at,
      })),
      total: countResult.count,
    };
  }

  /**
   * 获取笔记索引列表
   */
  getNoteIndexList(): NoteIndexInfo[] {
    const rows = this.db
      .prepare(
        `SELECT note_id, note_title, COUNT(*) as chunk_count, MAX(created_at) as last_indexed_at
         FROM chunk_metadata
         GROUP BY note_id
         ORDER BY last_indexed_at DESC`,
      )
      .all() as Array<{
      note_id: string;
      note_title: string;
      chunk_count: number;
      last_indexed_at: number;
    }>;

    return rows.map((row) => ({
      noteId: row.note_id,
      noteTitle: row.note_title,
      chunkCount: row.chunk_count,
      status: 'indexed' as const,
      lastIndexedAt: row.last_indexed_at,
    }));
  }

  /**
   * 清空所有数据（重建索引时调用）
   * 同时重置维度配置，以便适配新的 embedding 模型
   */
  clear(): void {
    // 删除向量表
    this.db.exec('DROP TABLE IF EXISTS vec_chunks');
    // 删除元数据
    this.db.exec('DELETE FROM chunk_metadata');
    // 重置维度配置，以便下次自动检测
    this.db.exec("DELETE FROM store_config WHERE key = 'dimension'");

    // 重置内部状态
    this.dimension = 0;
    this.autoDetectDimension = true;
    console.log('[VectorStore] Cleared all data, dimension will be auto-detected on next insert');
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
    this.initialized = false;
    console.log('[VectorStore] Database closed');
  }

  // ============ 诊断方法（专家功能）============

  /**
   * 获取数据库诊断信息
   */
  getDiagnostics(): {
    path: string;
    sizeBytes: number;
    journalMode: string;
    integrity: 'ok' | 'error';
    integrityMessage?: string;
    dimension: number;
    tableExists: boolean;
  } {
    // 获取文件大小
    let sizeBytes = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      sizeBytes = stats.size;
    } catch {
      // 忽略
    }

    // 获取 journal_mode
    const journalMode = (this.db.pragma('journal_mode') as { journal_mode: string }[])[0]
      ?.journal_mode;

    // 完整性检查
    let integrity: 'ok' | 'error' = 'ok';
    let integrityMessage: string | undefined;
    try {
      const result = this.db.pragma('integrity_check') as { integrity_check: string }[];
      if (result[0]?.integrity_check !== 'ok') {
        integrity = 'error';
        integrityMessage = result[0]?.integrity_check;
      }
    } catch (e) {
      integrity = 'error';
      integrityMessage = e instanceof Error ? e.message : String(e);
    }

    // 检查向量表是否存在
    let tableExists = false;
    try {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vec_chunks'")
        .all();
      tableExists = tables.length > 0;
    } catch {
      // 忽略
    }

    return {
      path: this.dbPath,
      sizeBytes,
      journalMode: journalMode || 'unknown',
      integrity,
      integrityMessage,
      dimension: this.dimension,
      tableExists,
    };
  }

  /**
   * 获取孤立向量数量（笔记已删除但向量仍存在）
   */
  getOrphanedVectorCount(existingNoteIds: string[]): number {
    if (existingNoteIds.length === 0) {
      // 如果没有笔记，所有向量都是孤立的
      const result = this.db
        .prepare('SELECT COUNT(DISTINCT note_id) as count FROM chunk_metadata')
        .get() as { count: number };
      return result.count;
    }

    // 使用 NOT IN 查询孤立笔记的向量数量
    const placeholders = existingNoteIds.map(() => '?').join(',');
    const result = this.db
      .prepare(
        `SELECT COUNT(DISTINCT note_id) as count FROM chunk_metadata WHERE note_id NOT IN (${placeholders})`,
      )
      .get(...existingNoteIds) as { count: number };
    return result.count;
  }

  /**
   * 清理孤立向量（笔记已删除但向量仍存在）
   */
  cleanupOrphanedVectors(existingNoteIds: string[]): number {
    if (existingNoteIds.length === 0) {
      // 清理所有向量
      const countResult = this.db.prepare('SELECT COUNT(*) as count FROM chunk_metadata').get() as {
        count: number;
      };
      this.db.exec('DELETE FROM chunk_metadata');
      this.db.exec('DELETE FROM vec_chunks');
      return countResult.count;
    }

    // 获取孤立笔记 ID
    const placeholders = existingNoteIds.map(() => '?').join(',');
    const orphanedNotes = this.db
      .prepare(`SELECT DISTINCT note_id FROM chunk_metadata WHERE note_id NOT IN (${placeholders})`)
      .all(...existingNoteIds) as { note_id: string }[];

    let cleaned = 0;
    for (const { note_id } of orphanedNotes) {
      cleaned += this.deleteByNoteId(note_id);
    }

    console.log(
      `[VectorStore] Cleaned up ${cleaned} orphaned vectors from ${orphanedNotes.length} notes`,
    );
    return cleaned;
  }
}

// ============ 单例管理 ============

let vectorStoreInstance: IVectorStore | null = null;

/**
 * 获取 VectorStore 单例
 */
export function getVectorStore(): IVectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new SqliteVectorStore();
    vectorStoreInstance.initialize();
  }
  return vectorStoreInstance;
}

/**
 * 关闭 VectorStore 单例
 */
export function closeVectorStore(): void {
  if (vectorStoreInstance) {
    vectorStoreInstance.close();
    vectorStoreInstance = null;
  }
}

// 为了向后兼容，保留 VectorStore 别名
export { SqliteVectorStore as VectorStore };
