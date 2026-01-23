/**
 * SQLite-vec 向量存储实现
 * 使用 better-sqlite3 + sqlite-vec 实现高性能向量检索
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { platform } from 'node:process';
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

    try {
      // 加载 sqlite-vec 扩展
      this.loadVectorExtension();

      // 启用 WAL 模式提升并发性能
      this.db.pragma('journal_mode = WAL');

      // 使用事务确保初始化过程的原子性
      const initializeDb = this.db.transaction(() => {
        // 1. 先创建配置表，以便后续读取维度
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS store_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `);

        // 2. 创建元数据表
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS chunk_metadata (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL,
            note_title TEXT,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            content_hash TEXT,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_chunk_note_id ON chunk_metadata(note_id);
          CREATE INDEX IF NOT EXISTS idx_chunk_hash ON chunk_metadata(content_hash);
        `);

        // 迁移：如果 content_hash 列不存在，添加它
        try {
          // 检查列是否存在
          const columns = this.db.pragma('table_info(chunk_metadata)') as Array<{
            name: string;
            [key: string]: unknown;
          }>;
          const hasHash = columns.some((c) => c.name === 'content_hash');
          if (!hasHash) {
            this.db.exec('ALTER TABLE chunk_metadata ADD COLUMN content_hash TEXT');
            console.log('[VectorStore] Migrated: Added content_hash column');
          }
        } catch (e) {
          console.error('[VectorStore] Migration failed:', e);
        }

        // 3. 尝试从配置表中读取已保存的维度
        const savedDimension = this.db
          .prepare('SELECT value FROM store_config WHERE key = ?')
          .get('dimension') as { value: string } | undefined;

        if (savedDimension) {
          this.dimension = parseInt(savedDimension.value, 10);
          this.autoDetectDimension = false;
          console.log('[VectorStore] Loaded saved dimension:', this.dimension);
        }
      });

      initializeDb();

      // 4. 如果有维度，创建向量表
      if (this.dimension > 0) {
        this.createVectorTable();
      }

      // 5. 创建 FTS5 全文索引表（用于混合搜索的关键词检索）
      this.createFtsTable();

      this.initialized = true;
    } catch (error) {
      console.error('[VectorStore] Critical error during initialization:', error);
      // 不要设置 initialized = true，以便下次重试
    }
  }

  /**
   * 创建 FTS5 全文索引表
   */
  private createFtsTable(): void {
    // 创建 FTS5 虚拟表（使用 unicode61 分词器，支持中英文）
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
        id,
        note_id,
        note_title,
        content,
        tokenize='unicode61'
      );
    `);

    // 检查触发器是否存在，不存在则创建
    const triggers = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='chunk_fts_insert'")
      .all();

    if (triggers.length === 0) {
      // INSERT 触发器
      this.db.exec(`
        CREATE TRIGGER chunk_fts_insert AFTER INSERT ON chunk_metadata BEGIN
          INSERT INTO chunk_fts(id, note_id, note_title, content)
          VALUES (new.id, new.note_id, new.note_title, new.content);
        END;
      `);

      // DELETE 触发器
      this.db.exec(`
        CREATE TRIGGER chunk_fts_delete AFTER DELETE ON chunk_metadata BEGIN
          DELETE FROM chunk_fts WHERE id = old.id;
        END;
      `);

      // UPDATE 触发器
      this.db.exec(`
        CREATE TRIGGER chunk_fts_update AFTER UPDATE ON chunk_metadata BEGIN
          DELETE FROM chunk_fts WHERE id = old.id;
          INSERT INTO chunk_fts(id, note_id, note_title, content)
          VALUES (new.id, new.note_id, new.note_title, new.content);
        END;
      `);

      console.log('[VectorStore] Created FTS5 table and triggers');

      // 同步现有数据到 FTS 表
      this.syncFtsData();
    }
  }

  /**
   * 同步现有数据到 FTS 表
   */
  private syncFtsData(): void {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM chunk_metadata').get() as {
      count: number;
    };

    if (count.count > 0) {
      this.db.exec(`
        INSERT OR IGNORE INTO chunk_fts(id, note_id, note_title, content)
        SELECT id, note_id, note_title, content FROM chunk_metadata;
      `);
      console.log(`[VectorStore] Synced ${count.count} chunks to FTS table`);
    }
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

      // 插入新元数据（包含 content_hash）
      this.db
        .prepare(
          `INSERT INTO chunk_metadata(id, note_id, note_title, chunk_index, content, content_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          metadata.noteId,
          metadata.noteTitle,
          metadata.chunkIndex,
          metadata.content,
          metadata.contentHash || null,
          now,
        );
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
      `INSERT INTO chunk_metadata(id, note_id, note_title, chunk_index, content, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const transaction = this.db.transaction(() => {
      for (const item of items) {
        // 删除旧数据
        deleteVec.run(item.id);
        deleteMeta.run(item.id);

        // 插入新数据（包含 content_hash）
        const float32 = new Float32Array(item.embedding);
        insertVec.run(item.id, Buffer.from(float32.buffer));
        insertMeta.run(
          item.id,
          item.metadata.noteId,
          item.metadata.noteTitle,
          item.metadata.chunkIndex,
          item.metadata.content,
          item.metadata.contentHash || null,
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
   * 获取指定笔记的所有 chunks 及其 hash（用于增量更新）
   */
  getChunksByNoteId(noteId: string): Array<{
    id: string;
    chunkIndex: number;
    contentHash: string | null;
  }> {
    const rows = this.db
      .prepare(
        'SELECT id, chunk_index, content_hash FROM chunk_metadata WHERE note_id = ? ORDER BY chunk_index',
      )
      .all(noteId) as Array<{
      id: string;
      chunk_index: number;
      content_hash: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      chunkIndex: r.chunk_index,
      contentHash: r.content_hash,
    }));
  }

  /**
   * 批量删除指定 ID 的向量
   */
  deleteByIds(ids: string[]): number {
    if (ids.length === 0) return 0;

    const deleteVec = this.db.prepare('DELETE FROM vec_chunks WHERE id = ?');
    const deleteMeta = this.db.prepare('DELETE FROM chunk_metadata WHERE id = ?');

    const transaction = this.db.transaction(() => {
      for (const id of ids) {
        deleteVec.run(id);
        deleteMeta.run(id);
      }
    });

    transaction();
    console.log(`[VectorStore] Deleted ${ids.length} vectors by IDs`);
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
   * 关键词搜索（使用 FTS5）
   */
  keywordSearch(query: string, topK: number = 3): SearchResult[] {
    try {
      // 清理查询：转义 FTS5 特殊字符
      const cleanQuery = query
        .replace(/['"*()]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((word) => `"${word}"`)
        .join(' OR ');

      if (!cleanQuery) {
        return [];
      }

      const results = this.db
        .prepare(
          `SELECT 
            f.id,
            f.note_id,
            f.note_title,
            f.content,
            bm25(chunk_fts) as rank
          FROM chunk_fts f
          WHERE chunk_fts MATCH ?
          ORDER BY rank
          LIMIT ?`,
        )
        .all(cleanQuery, topK) as Array<{
        id: string;
        note_id: string;
        note_title: string;
        content: string;
        rank: number;
      }>;

      return results.map((r) => ({
        id: r.id,
        noteId: r.note_id,
        noteTitle: r.note_title,
        content: r.content,
        distance: -r.rank, // BM25 排名转为距离（负值表示更好）
        score: Math.max(0, 1 + r.rank * 0.1), // 将 BM25 排名转为 0-1 分数
      }));
    } catch (error) {
      console.warn('[VectorStore] Keyword search failed:', error);
      return [];
    }
  }

  /**
   * 混合搜索（向量搜索 + 关键词搜索 + RRF 融合）
   */
  hybridSearch(queryEmbedding: number[], queryText: string, topK: number = 3): SearchResult[] {
    // 并行执行两种搜索，每种多取一些结果用于融合
    const vectorResults = this.search(queryEmbedding, topK * 2);
    const keywordResults = this.keywordSearch(queryText, topK * 2);

    // 如果其中一种搜索没有结果，直接返回另一种
    if (vectorResults.length === 0) {
      return keywordResults.slice(0, topK);
    }
    if (keywordResults.length === 0) {
      return vectorResults.slice(0, topK);
    }

    // RRF 融合排序
    const fusedResults = this.reciprocalRankFusion([vectorResults, keywordResults], topK);

    console.log(
      `[HybridSearch] Vector: ${vectorResults.length}, Keyword: ${keywordResults.length}, Fused: ${fusedResults.length}`,
    );

    return fusedResults;
  }

  /**
   * Reciprocal Rank Fusion (RRF) 算法
   * 融合多个搜索结果列表
   */
  private reciprocalRankFusion(
    resultSets: SearchResult[][],
    topK: number,
    k: number = 60, // RRF 参数，通常取 60
  ): SearchResult[] {
    const scoreMap = new Map<string, { score: number; result: SearchResult }>();

    for (const results of resultSets) {
      results.forEach((result, rank) => {
        const rrfScore = 1 / (k + rank + 1);
        const existing = scoreMap.get(result.id);

        if (existing) {
          existing.score += rrfScore;
          // 如果找到相同结果，保留分数更高的那个
          if (result.score > existing.result.score) {
            existing.result = result;
          }
        } else {
          scoreMap.set(result.id, { score: rrfScore, result });
        }
      });
    }

    // 按 RRF 分数排序并返回 topK
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        ...item.result,
        score: item.score, // 用 RRF 分数替换原分数
      }));
  }

  /**
   * 加载向量扩展插件，处理 ASAR 环境下的路径重定向
   */
  private loadVectorExtension(): void {
    try {
      // 1. 获取原始路径
      let loadablePath = sqliteVec.getLoadablePath();

      // 2. 如果在生产环境（ASAR）运行，需要重定向到 unpacked 目录
      if (app.isPackaged) {
        // 将 .../app.asar/... 替换为 .../app.asar.unpacked/...
        loadablePath = loadablePath.replace('app.asar', 'app.asar.unpacked');
      }

      // 3. 检查文件是否存在
      if (!fs.existsSync(loadablePath)) {
        // 尝试自动补全后缀名（有些系统驱动会自动加，有些不会，这里手动检查）
        const suffix = platform === 'win32' ? '.dll' : platform === 'darwin' ? '.dylib' : '.so';
        if (!loadablePath.endsWith(suffix) && fs.existsSync(loadablePath + suffix)) {
          loadablePath += suffix;
        }
      }

      console.log('[VectorStore] Loading extension from:', loadablePath);

      // 4. 执行加载
      // 注意：better-sqlite3 的 loadExtension 在某些版本下如果带了后缀名
      // 且驱动又自动加了一次，会导致 .dylib.dylib 错误。
      // 我们移除显式的后缀名，让系统驱动根据平台自动处理，
      // 但前提是文件必须已经存在于那个位置。
      const extensionPathWithoutSuffix = loadablePath.replace(/\.(dylib|dll|so)$/, '');

      this.db.loadExtension(extensionPathWithoutSuffix);
    } catch (error) {
      console.error('[VectorStore] Failed to load sqlite-vec extension:', error);
      throw error;
    }
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
   * 完全删除所有表并重新初始化，以确保表结构与最新代码一致
   */
  clear(): void {
    // 删除所有相关表
    this.db.exec('DROP TABLE IF EXISTS vec_chunks');
    this.db.exec('DROP TABLE IF EXISTS chunk_fts');
    this.db.exec('DROP TABLE IF EXISTS chunk_metadata');

    // 删除触发器
    this.db.exec('DROP TRIGGER IF EXISTS chunk_fts_insert');
    this.db.exec('DROP TRIGGER IF EXISTS chunk_fts_delete');
    this.db.exec('DROP TRIGGER IF EXISTS chunk_fts_update');

    // 重置维度配置，以便下次自动检测
    try {
      this.db.exec("DELETE FROM store_config WHERE key = 'dimension'");
    } catch {
      // 如果表不存在，忽略
    }

    // 重置内部状态
    this.dimension = 0;
    this.autoDetectDimension = true;
    this.initialized = false;

    console.log('[VectorStore] Cleared all tables, will reinitialize on next operation');

    // 重新初始化表结构
    this.initialize();
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
