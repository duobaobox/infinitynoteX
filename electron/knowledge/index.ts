/**
 * 知识库模块统一导出
 * 对外暴露单一入口，隐藏内部实现细节
 */

// ============ 类型导出 ============
export type {
  // 向量存储接口
  IVectorStore,
  VectorMetadata,
  SearchResult,
  VectorStoreStats,
  // Embedding 相关
  EmbeddingConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  // 知识库搜索
  KnowledgeSearchResult,
  KnowledgeStats,
} from './types';

// ============ Embedding 服务 ============
export {
  EmbeddingService,
  createEmbeddingService,
  getEmbeddingService,
  readKnowledgeConfig,
  writeKnowledgeConfig,
} from './embedding';

// ============ 向量存储 ============
export {
  SqliteVectorStore,
  VectorStore, // 向后兼容别名
  getVectorStore,
  closeVectorStore,
} from './vectorStore';

// ============ 知识索引服务 ============
export {
  extractNoteText,
  chunkText,
  indexNote,
  rebuildAllIndex,
  semanticSearch,
  getIndexStats,
  // 增量更新
  incrementalUpdate,
  reindexNote,
  deleteNoteFromIndex,
} from './knowledgeIndex';
