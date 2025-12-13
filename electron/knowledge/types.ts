/**
 * 知识库模块类型定义
 * 包含 VectorStore 接口和相关类型
 */

// ============ 向量存储接口 ============

/**
 * 向量元数据
 */
export interface VectorMetadata {
  noteId: string;
  noteTitle: string;
  chunkIndex: number;
  content: string;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string;
  noteId: string;
  noteTitle: string;
  content: string;
  distance: number;
  score: number;
}

/**
 * 向量存储统计
 */
export interface VectorStoreStats {
  totalVectors: number;
  uniqueNotes: number;
}

/**
 * 数据块信息（面向 UI）
 */
export interface ChunkInfo {
  id: string;
  noteId: string;
  noteTitle: string;
  chunkIndex: number;
  content: string;
  dimension: number;
  createdAt: number;
}

/**
 * 笔记索引信息
 */
export interface NoteIndexInfo {
  noteId: string;
  noteTitle: string;
  chunkCount: number;
  status: 'indexed' | 'pending' | 'failed';
  lastIndexedAt?: number;
}

/**
 * 向量存储接口
 * 抽象层，支持未来切换不同的向量数据库实现
 */
export interface IVectorStore {
  /**
   * 初始化存储
   */
  initialize(): void;

  /**
   * 插入或更新单个向量
   */
  upsert(id: string, embedding: number[], metadata: VectorMetadata): void;

  /**
   * 批量插入向量
   */
  upsertBatch(items: Array<{ id: string; embedding: number[]; metadata: VectorMetadata }>): void;

  /**
   * 删除某个笔记的所有向量
   */
  deleteByNoteId(noteId: string): number;

  /**
   * 向量相似度搜索
   */
  search(queryEmbedding: number[], topK?: number): SearchResult[];

  /**
   * 获取统计信息
   */
  getStats(): VectorStoreStats;

  /**
   * 获取数据块列表（分页）
   */
  getChunks?(options: { noteId?: string; offset?: number; limit?: number }): {
    chunks: ChunkInfo[];
    total: number;
  };

  /**
   * 获取笔记索引列表
   */
  getNoteIndexList?(): NoteIndexInfo[];

  /**
   * 清空所有数据
   */
  clear(): void;

  /**
   * 关闭连接
   */
  close(): void;

  // ============ 诊断方法（专家功能）============

  /**
   * 获取数据库诊断信息
   */
  getDiagnostics?(): {
    path: string;
    sizeBytes: number;
    journalMode: string;
    integrity: 'ok' | 'error';
    integrityMessage?: string;
    dimension: number;
    tableExists: boolean;
  };

  /**
   * 获取孤立向量数量（笔记已删除但向量仍存在）
   */
  getOrphanedVectorCount?(existingNoteIds: string[]): number;

  /**
   * 清理孤立向量
   */
  cleanupOrphanedVectors?(existingNoteIds: string[]): number;
}

// ============ Embedding 相关类型 ============

/**
 * Embedding 模型配置（OpenAI 风格 API）
 */
export interface EmbeddingConfig {
  /** 预设的模型提供商 ID */
  providerId?: string;
  /** 模型提供商名称 */
  provider: string;
  /** API 基础 URL */
  baseURL: string;
  /** API Key */
  apiKey?: string;
  /** 模型名称 */
  model: string;
  /** 向量维度（可选，有些模型需要指定） */
  dimensions?: number;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * Embedding 请求体
 */
export interface EmbeddingRequest {
  input: string | string[];
  model: string;
  dimensions?: number;
}

/**
 * Embedding 响应体（OpenAI 风格）
 */
export interface EmbeddingResponse {
  object: 'list';
  model: string;
  data: Array<{
    object: 'embedding';
    index: number;
    embedding: number[];
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============ 知识库搜索结果 ============

/**
 * 知识库搜索结果（面向 UI）
 */
export interface KnowledgeSearchResult {
  /** 笔记 ID */
  noteId: string;
  /** 笔记标题 */
  noteTitle: string;
  /** 相关片段 */
  excerpt: string;
  /** 相关度评分 */
  score: number;
}

/**
 * 知识库统计
 */
export interface KnowledgeStats {
  /** 是否启用 */
  enabled: boolean;
  /** 已索引笔记数 */
  indexedNotes: number;
  /** 总向量数 */
  totalVectors: number;
  /** 最后索引时间 */
  lastIndexedAt?: number;
}

// ============ 专家功能类型 ============

/**
 * 系统诊断结果
 */
export interface DiagnosticsResult {
  /** 数据库状态 */
  database: {
    path: string;
    sizeBytes: number;
    journalMode: string;
    integrity: 'ok' | 'error';
    integrityMessage?: string;
  };
  /** 向量存储状态 */
  vectorStore: {
    dimension: number;
    totalVectors: number;
    uniqueNotes: number;
    tableExists: boolean;
  };
  /** 索引一致性 */
  indexConsistency: {
    orphanedVectors: number;
    missingIndexNotes: number;
    inconsistentNotes: string[];
  };
  /** Embedding 配置状态 */
  embeddingConfig: {
    configured: boolean;
    provider?: string;
    model?: string;
    lastTestResult?: 'success' | 'failed' | 'unknown';
  };
}

/**
 * 索引配置
 */
export interface IndexingConfig {
  /** 分块大小（字符数），默认 500 */
  chunkSize: number;
  /** 重叠字符数，默认 50 */
  chunkOverlap: number;
  /** 批处理大小，默认 5 */
  batchSize: number;
  /** 批次间延迟（毫秒），默认 1000 */
  batchDelayMs: number;
  /** 速率限制重试延迟（毫秒），默认 5000 */
  rateLimitRetryMs: number;
}

/**
 * 索引修复结果
 */
export interface RepairResult {
  success: boolean;
  orphanedCleaned: number;
  missingIndexed: number;
  error?: string;
}
