/**
 * SQLite-vec 向量存储封装
 * 使用 better-sqlite3 + sqlite-vec 实现高性能向量检索
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { app } from 'electron';

// ============ 类型定义 ============

export interface VectorMetadata {
  noteId: string;
  noteTitle: string;
  chunkIndex: number;
  content: string;
}

export interface SearchResult {
  id: string;
  noteId: string;
  noteTitle: string;
  content: string;
  distance: number;
  score: number; // 1 / (1 + distance)
}

// ============ VectorStore 类 ============

export class VectorStore {
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
   * 设置向量维度（需要在初始化前调用）
   */
  setDimension(dimension: number): void {
    if (this.initialized) {
      console.warn('[VectorStore] Cannot change dimension after initialization');
      return;
    }
    this.dimension = dimension;
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
  getStats(): { totalVectors: number; uniqueNotes: number } {
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
}

// ============ 单例管理 ============

let vectorStoreInstance: VectorStore | null = null;

/**
 * 获取 VectorStore 单例
 */
export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
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
