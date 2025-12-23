/**
 * 索引缓存
 *
 * 使用 SQLite 替代 .index.json 文件
 * 提供高性能的列表查询和全文搜索
 */

import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface IndexItem {
  id: string;
  module: string;
  title: string;
  excerpt: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  fileHash?: string;
}

export interface ListOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  filter?: Record<string, unknown>;
}

export interface SearchResult extends IndexItem {
  score: number;
}

export class IndexCache {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    try {
      console.log(`[IndexCache] Initializing database at: ${this.dbPath}`);
      this.db = new Database(this.dbPath);
      console.log('[IndexCache] better-sqlite3 loaded successfully');
    } catch (error) {
      // 详细记录原生模块加载错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[IndexCache] Failed to load better-sqlite3:', errorMessage);
      console.error('[IndexCache] This is likely a native module compilation issue.');
      console.error('[IndexCache] Database path:', this.dbPath);

      // 重新抛出错误，但附加更多上下文
      throw new Error(
        `Failed to initialize SQLite database: ${errorMessage}. ` +
          `This may be caused by native module compatibility issues. ` +
          `Please ensure better-sqlite3 is properly rebuilt for Electron.`,
      );
    }

    this.db.pragma('journal_mode = WAL');

    // 创建主表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT NOT NULL,
        module TEXT NOT NULL,
        title TEXT,
        excerpt TEXT,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        file_hash TEXT,
        PRIMARY KEY (module, id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_items_module ON items(module);
      CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
    `);

    // 创建全文搜索虚拟表
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        id,
        module,
        title,
        excerpt,
        content='items',
        content_rowid='rowid'
      );
    `);

    // 创建触发器以保持 FTS 同步
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, id, module, title, excerpt)
        VALUES (NEW.rowid, NEW.id, NEW.module, NEW.title, NEW.excerpt);
      END;
      
      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, id, module, title, excerpt)
        VALUES ('delete', OLD.rowid, OLD.id, OLD.module, OLD.title, OLD.excerpt);
      END;
      
      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, id, module, title, excerpt)
        VALUES ('delete', OLD.rowid, OLD.id, OLD.module, OLD.title, OLD.excerpt);
        INSERT INTO items_fts(rowid, id, module, title, excerpt)
        VALUES (NEW.rowid, NEW.id, NEW.module, NEW.title, NEW.excerpt);
      END;
    `);

    console.log('[IndexCache] Database initialized successfully');
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 插入或更新索引项
   */
  upsertItem(item: IndexItem): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO items (id, module, title, excerpt, metadata, created_at, updated_at, file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.id,
      item.module,
      item.title,
      item.excerpt,
      JSON.stringify(item.metadata),
      item.createdAt,
      item.updatedAt,
      item.fileHash || null,
    );
  }

  /**
   * 批量插入或更新
   */
  upsertItems(items: IndexItem[]): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO items (id, module, title, excerpt, metadata, created_at, updated_at, file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: IndexItem[]) => {
      for (const item of items) {
        stmt.run(
          item.id,
          item.module,
          item.title,
          item.excerpt,
          JSON.stringify(item.metadata),
          item.createdAt,
          item.updatedAt,
          item.fileHash || null,
        );
      }
    });

    transaction(items);
  }

  /**
   * 删除索引项
   */
  deleteItem(module: string, id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM items WHERE module = ? AND id = ?');
    stmt.run(module, id);
  }

  /**
   * 获取单个索引项
   */
  getItem(module: string, id: string): IndexItem | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM items WHERE module = ? AND id = ?');
    const row = stmt.get(module, id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToItem(row);
  }

  /**
   * 列出模块的所有索引项
   */
  listItems(module: string, options?: ListOptions): IndexItem[] {
    if (!this.db) throw new Error('Database not initialized');

    const sortBy = options?.sortBy || 'updated_at';
    const sortOrder = options?.sortOrder || 'desc';
    const limit = options?.limit || 1000;
    const offset = options?.offset || 0;

    // 安全地构建排序字段（防止 SQL 注入）
    const allowedSortFields = ['created_at', 'updated_at', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'updated_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const stmt = this.db.prepare(`
      SELECT * FROM items 
      WHERE module = ? 
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(module, limit, offset) as Record<string, unknown>[];
    return rows.map((row) => this.rowToItem(row));
  }

  /**
   * 获取模块索引项数量
   */
  countItems(module: string): number {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM items WHERE module = ?');
    const result = stmt.get(module) as { count: number };
    return result.count;
  }

  /**
   * 全文搜索
   */
  search(query: string, modules?: string[]): SearchResult[] {
    if (!this.db) throw new Error('Database not initialized');

    let sql = `
      SELECT items.*, items_fts.rank AS score
      FROM items_fts
      JOIN items ON items.rowid = items_fts.rowid
      WHERE items_fts MATCH ?
    `;

    const params: unknown[] = [query];

    if (modules && modules.length > 0) {
      const placeholders = modules.map(() => '?').join(', ');
      sql += ` AND items.module IN (${placeholders})`;
      params.push(...modules);
    }

    sql += ' ORDER BY rank LIMIT 100';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as (Record<string, unknown> & { score: number })[];

    return rows.map((row) => ({
      ...this.rowToItem(row),
      score: row.score,
    }));
  }

  /**
   * 清空模块的所有索引
   */
  clearModule(module: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM items WHERE module = ?');
    stmt.run(module);
  }

  /**
   * 清空所有索引
   */
  clearAll(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec('DELETE FROM items');
  }

  /**
   * 从文件重建模块索引
   */
  async rebuildFromFiles(
    module: string,
    directory: string,
    parser: (filePath: string) => Promise<IndexItem | null>,
  ): Promise<{ rebuilt: number; errors: string[] }> {
    const errors: string[] = [];
    let rebuilt = 0;

    // 先清空该模块的索引
    this.clearModule(module);

    try {
      const files = await fs.readdir(directory);
      const items: IndexItem[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(directory, file);
        try {
          const item = await parser(filePath);
          if (item) {
            items.push(item);
            rebuilt++;
          }
        } catch (err) {
          errors.push(`Failed to parse ${file}: ${err}`);
        }
      }

      // 批量插入
      if (items.length > 0) {
        this.upsertItems(items);
      }
    } catch (err) {
      errors.push(`Failed to read directory: ${err}`);
    }

    return { rebuilt, errors };
  }

  /**
   * 将数据库行转换为 IndexItem
   */
  private rowToItem(row: Record<string, unknown>): IndexItem {
    return {
      id: row.id as string,
      module: row.module as string,
      title: row.title as string,
      excerpt: row.excerpt as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      fileHash: row.file_hash as string | undefined,
    };
  }
}
