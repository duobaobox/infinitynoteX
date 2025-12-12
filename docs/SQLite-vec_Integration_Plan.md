# SQLite-vec 向量库集成开发计划

> **版本**: v1.1 (简化版)\
> **创建日期**: 2025-12-12\
> **开发模式**: 🔥 **破坏性开发** - 不考虑数据迁移和向后兼容\
> **目标**: 将 RAG 知识库的向量存储从 JSON 文件直接替换为 SQLite-vec

---

## 一、背景与目标

### 1.1 现状问题

当前 RAG 系统使用 `vector-index.json` 文件存储向量数据，存在以下问题：

| 问题           | 影响                        | 严重程度 |
| -------------- | --------------------------- | -------- |
| 全量加载到内存 | 笔记多时启动慢、内存占用高  | ⭐⭐⭐⭐ |
| 增量更新困难   | 每次更新需重写整个文件      | ⭐⭐⭐⭐ |
| 检索效率低     | O(n) 暴力遍历，笔记多时变慢 | ⭐⭐⭐   |
| 并发写入风险   | 无事务保护，可能数据损坏    | ⭐⭐⭐   |

### 1.2 目标

| 指标                 | 当前 (JSON)    | 目标 (SQLite-vec) |
| -------------------- | -------------- | ----------------- |
| 1000 向量检索时间    | ~500ms         | < 50ms            |
| 启动加载时间         | ~3s (全量加载) | < 100ms (按需)    |
| 内存占用 (1000 向量) | ~50MB          | < 10MB            |
| 增量更新             | 重写全文件     | 单行操作          |

---

## 二、技术方案

### 2.1 技术选型

**核心依赖**：

| 依赖                | 版本   | 作用                    |
| ------------------- | ------ | ----------------------- |
| `better-sqlite3`    | ^11.x  | 高性能同步 SQLite 驱动  |
| `sqlite-vec`        | ^0.1.x | SQLite 向量扩展         |
| `@electron/rebuild` | ^3.x   | Electron 原生模块重编译 |

**为什么选择这个组合**：

1. **better-sqlite3**：比 `node-sqlite3` 快 2-3 倍，同步 API 更简单。
2. **sqlite-vec**：官方 Node.js 绑定，与 better-sqlite3 兼容。
3. **单文件数据库**：符合 Electron 本地存储理念，便于备份迁移。

### 2.2 数据库设计

#### 文件位置

```
{userData}/
├── knowledge.db          # SQLite 数据库文件
├── knowledge.db-wal      # WAL 日志（自动生成）
└── knowledge.db-shm      # 共享内存（自动生成）
```

#### Schema 设计

```sql
-- 启用 WAL 模式（提升并发性能）
PRAGMA journal_mode = WAL;

-- 向量表（sqlite-vec 虚拟表）
CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
  id TEXT PRIMARY KEY,           -- 格式: {noteId}-{chunkIndex}
  embedding float[1536]          -- 向量维度（根据 Embedding 模型调整）
);

-- 元数据表
CREATE TABLE IF NOT EXISTS chunk_metadata (
  id TEXT PRIMARY KEY,           -- 与 vec_chunks.id 对应
  note_id TEXT NOT NULL,         -- 原始笔记 ID
  note_title TEXT,               -- 笔记标题
  chunk_index INTEGER NOT NULL,  -- 分块索引
  content TEXT NOT NULL,         -- 分块文本（用于展示）
  created_at INTEGER NOT NULL,   -- 创建时间戳
  updated_at INTEGER NOT NULL    -- 更新时间戳
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chunk_note_id ON chunk_metadata(note_id);

-- 配置表（存储元信息）
CREATE TABLE IF NOT EXISTS knowledge_config (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### 2.3 核心 API 设计

#### VectorStore 类接口

```typescript
// electron/vectorStore.ts

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
  distance: number; // 越小越相似
  score: number; // 转换后的相似度分数 (0-1)
}

export class VectorStore {
  constructor(dbPath: string);

  // 初始化（创建表、加载扩展）
  initialize(): void;

  // 插入/更新向量
  upsert(id: string, embedding: number[], metadata: VectorMetadata): void;

  // 批量插入
  upsertBatch(items: Array<{ id: string; embedding: number[]; metadata: VectorMetadata }>): void;

  // 删除笔记的所有向量
  deleteByNoteId(noteId: string): number;

  // 向量搜索
  search(queryEmbedding: number[], topK?: number): SearchResult[];

  // 获取统计信息
  getStats(): { totalVectors: number; uniqueNotes: number };

  // 清空所有数据
  clear(): void;

  // 关闭数据库连接
  close(): void;
}
```

### 2.4 架构变更

#### 变更前

```
useAIChat.ts --> IPC --> knowledgeIndex.ts --> InMemoryVectorStore
                                                     |
                                                     v
                                              vector-index.json
```

#### 变更后

```
useAIChat.ts --> IPC --> knowledgeIndex.ts --> VectorStore (新)
                                                     |
                                                     v
                                              knowledge.db (SQLite-vec)
```

---

## 三、开发任务 (简化版)

> ⚡ **破坏性开发模式**：直接删除旧的 JSON 实现，无需迁移

### 3.1 任务分解

| 任务 ID | 任务描述                                              | 预估工时 | 依赖 |
| ------- | ----------------------------------------------------- | -------- | ---- |
| **T1**  | **环境搭建**                                          |          |      |
| T1.1    | 安装 `better-sqlite3` 和 `sqlite-vec`                 | 0.5h     | -    |
| T1.2    | 配置 `@electron/rebuild`，解决原生模块编译            | 1h       | T1.1 |
| T1.3    | 验证 `sqlite-vec` 在 Electron 中正常加载              | 0.5h     | T1.2 |
| **T2**  | **核心实现**                                          |          |      |
| T2.1    | 创建 `electron/vectorStore.ts`，实现 VectorStore 类   | 3h       | T1.3 |
| T2.2    | 实现 `upsert` / `deleteByNoteId` / `search` / `clear` | 2h       | T2.1 |
| **T3**  | **集成替换**                                          |          |      |
| T3.1    | **删除** `InMemoryVectorStore` 相关代码               | 0.5h     | T2.2 |
| T3.2    | 重构 `knowledgeIndex.ts`，使用新的 VectorStore        | 2h       | T3.1 |
| T3.3    | 删除旧的 `vector-index.json` 相关逻辑                 | 0.5h     | T3.1 |
| **T4**  | **验证**                                              |          |      |
| T4.1    | 手动测试：RAG 对话端到端验证                          | 1h       | T3.2 |

### 3.2 工时汇总

| 阶段     | 工时                |
| -------- | ------------------- |
| 环境搭建 | 2h                  |
| 核心实现 | 5h                  |
| 集成替换 | 3h                  |
| 验证     | 1h                  |
| **总计** | **11h (~1.5 人天)** |

### 3.3 删除清单

以下内容将被**直接删除**，不做兼容处理：

- [ ] `electron/knowledgeIndex.ts` 中的 `InMemoryVectorStore` 类
- [ ] `vector-index.json` 文件读写逻辑
- [ ] `cosineSimilarity` 手动计算函数（SQLite-vec 内置）
- [ ] 用户本地的 `vector-index.json` 数据（需手动重建索引）

---

## 四、实现细节

### 4.1 安装与配置

```bash
# 安装核心依赖
cnpm install better-sqlite3 sqlite-vec --save

# 安装 Electron rebuild 工具
cnpm install @electron/rebuild --save-dev
```

#### package.json 配置

```json
{
  "scripts": {
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  }
}
```

#### 编译原生模块

```bash
# 每次安装依赖后执行
npm run rebuild
```

### 4.2 VectorStore 实现

```typescript
// electron/vectorStore.ts

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'node:path';
import { app } from 'electron';

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
  score: number;
}

export class VectorStore {
  private db: Database.Database;
  private dimension: number;

  constructor(dbPath?: string) {
    const defaultPath = path.join(app.getPath('userData'), 'knowledge.db');
    this.db = new Database(dbPath || defaultPath);
    this.dimension = 1536;
  }

  initialize(): void {
    sqliteVec.load(this.db);
    this.db.pragma('journal_mode = WAL');

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

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[${this.dimension}]
      );
    `);

    console.log('[VectorStore] Initialized');
  }

  upsert(id: string, embedding: number[], metadata: VectorMetadata): void {
    const now = Date.now();
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM vec_chunks WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM chunk_metadata WHERE id = ?').run(id);

      this.db
        .prepare('INSERT INTO vec_chunks(id, embedding) VALUES (?, ?)')
        .run(id, new Float32Array(embedding).buffer);

      this.db
        .prepare(
          `
        INSERT INTO chunk_metadata(id, note_id, note_title, chunk_index, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .run(id, metadata.noteId, metadata.noteTitle, metadata.chunkIndex, metadata.content, now);
    });
    transaction();
  }

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
    return ids.length;
  }

  search(queryEmbedding: number[], topK: number = 3): SearchResult[] {
    const results = this.db
      .prepare(
        `
      SELECT v.id, v.distance, m.note_id, m.note_title, m.content
      FROM vec_chunks v
      JOIN chunk_metadata m ON v.id = m.id
      WHERE v.embedding MATCH ?
      ORDER BY v.distance
      LIMIT ?
    `,
      )
      .all(new Float32Array(queryEmbedding).buffer, topK) as Array<{
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
      score: 1 / (1 + r.distance),
    }));
  }

  getStats(): { totalVectors: number; uniqueNotes: number } {
    const vectorCount = this.db.prepare('SELECT COUNT(*) as count FROM vec_chunks').get() as {
      count: number;
    };
    const noteCount = this.db
      .prepare('SELECT COUNT(DISTINCT note_id) as count FROM chunk_metadata')
      .get() as { count: number };
    return { totalVectors: vectorCount.count, uniqueNotes: noteCount.count };
  }

  clear(): void {
    this.db.exec('DELETE FROM vec_chunks');
    this.db.exec('DELETE FROM chunk_metadata');
  }

  close(): void {
    this.db.close();
  }
}
```

---

## 五、Electron 打包配置

### 5.1 electron-builder 配置

```json
{
  "asarUnpack": ["node_modules/better-sqlite3/**", "node_modules/sqlite-vec/**"]
}
```

### 5.2 已知问题与解决

| 问题            | 平台    | 解决方案                                |
| --------------- | ------- | --------------------------------------- |
| `.dylib` 未打包 | macOS   | 配置 `asarUnpack`                       |
| `.dll` 加载失败 | Windows | 使用 `electron-rebuild` 重新编译        |
| 架构不匹配      | M1 Mac  | 确保 `electron-rebuild` 使用正确的 arch |

---

## 六、验收标准

### 功能验收

- [ ] SQLite-vec 扩展在 Electron 主进程中正常加载
- [ ] 向量插入、删除操作正常
- [ ] KNN 搜索返回正确结果
- [ ] 应用启动时自动初始化数据库
- [ ] 设置页面 "重建索引" 功能正常

### 性能验收

- [ ] 100 向量检索时间 < 50ms
- [ ] 启动时间无明显增加

---

## 七、相关文件变更

| 文件                         | 变更类型 | 说明                                         |
| ---------------------------- | -------- | -------------------------------------------- |
| `electron/vectorStore.ts`    | **新增** | SQLite-vec 封装类                            |
| `electron/knowledgeIndex.ts` | **重构** | 删除 InMemoryVectorStore，使用新 VectorStore |
| `package.json`               | **更新** | 添加 better-sqlite3、sqlite-vec 依赖         |

### 删除的文件/代码

- `vector-index.json` 相关读写逻辑
- `InMemoryVectorStore` 类
- `cosineSimilarity` 函数

---

## 附录：参考资料

- [sqlite-vec 官方文档](https://alexgarcia.xyz/sqlite-vec/)
- [sqlite-vec NPM 包](https://www.npmjs.com/package/sqlite-vec)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)
