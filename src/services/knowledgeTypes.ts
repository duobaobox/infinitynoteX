/**
 * 知识库配置定义
 * 包含 Embedding 模型配置和知识库设置
 */

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
 * 知识库配置
 */
export interface KnowledgeBaseConfig {
  /** 是否启用知识库 */
  enabled: boolean;
  /** Embedding 配置 */
  embedding?: EmbeddingConfig;
  /** 数据源配置 */
  sources: {
    /** 便签向量化 */
    notes: boolean;
    /** 剪切板向量化（预留） */
    clipboard: boolean;
  };
  /** 分块配置 */
  chunking: {
    /** 分块大小（字符数） */
    chunkSize: number;
    /** 分块重叠（字符数） */
    chunkOverlap: number;
  };
  /** 检索配置 */
  retrieval: {
    /** 返回的最大结果数 */
    topK: number;
    /** 最小相似度阈值 */
    minScore: number;
  };
}

/**
 * 默认知识库配置
 */
export const DEFAULT_KNOWLEDGE_BASE_CONFIG: KnowledgeBaseConfig = {
  enabled: false,
  sources: {
    notes: true,
    clipboard: false,
  },
  chunking: {
    chunkSize: 500,
    chunkOverlap: 50,
  },
  retrieval: {
    topK: 3,
    minScore: 0.7,
  },
};

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

/**
 * 向量元数据
 */
export interface VectorMetadata {
  /** 数据源类型 */
  sourceType: 'note' | 'clipboard' | string;
  /** 原始资源 ID */
  sourceId: string;
  /** 原文内容（用于展示） */
  content: string;
  /** 标题 */
  title?: string;
  /** 分块索引 */
  chunkIndex?: number;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  /** 元数据 */
  metadata: VectorMetadata;
  /** 相似度分数 */
  score: number;
}

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
