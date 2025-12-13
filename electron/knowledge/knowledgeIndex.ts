/**
 * 知识库索引服务
 * 负责笔记内容提取、分块和向量化
 * 使用 SQLite-vec 实现高性能向量存储
 */

import { storageManager } from '../storage';
import { readKnowledgeConfig, createEmbeddingService, type EmbeddingService } from './embedding';
import { getVectorStore } from './vectorStore';
import type {
  VectorMetadata,
  KnowledgeSearchResult,
  IndexingConfig,
  DiagnosticsResult,
  RepairResult,
} from './types';

// 重新导出类型
export type {
  KnowledgeSearchResult,
  IndexingConfig,
  DiagnosticsResult,
  RepairResult,
} from './types';

// ============ TipTap JSON 转文本 ============

/**
 * 递归提取 TipTap JSON 中的纯文本
 */
function extractTextFromTipTap(node: any): string {
  if (!node) return '';

  // 文本节点
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  // 代码块 - 保留代码内容
  if (node.type === 'codeBlock' && node.content) {
    const code = node.content.map((c: any) => c.text || '').join('');
    return `\n${code}\n`;
  }

  // 递归处理子节点
  if (Array.isArray(node.content)) {
    const texts = node.content.map(extractTextFromTipTap);

    // 块级元素添加换行
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
      return texts.join('') + '\n';
    }

    return texts.join('');
  }

  return '';
}

/**
 * 从笔记内容提取纯文本
 */
export function extractNoteText(content: any): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  const text = extractTextFromTipTap(content);
  // 清理多余空白
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// ============ 文本分块 ============

interface TextChunk {
  text: string;
  index: number;
}

/**
 * 将文本分割成固定大小的块（带重叠）
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  chunkOverlap: number = 50,
): TextChunk[] {
  if (!text || text.length === 0) {
    return [];
  }

  // 如果文本小于块大小，直接返回
  if (text.length <= chunkSize) {
    return [{ text, index: 0 }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // 尝试在句子边界切分
    if (end < text.length) {
      const slice = text.slice(start, end + 50);
      const sentenceEnd = slice.search(/[。！？.!?]\s*/);
      if (sentenceEnd > chunkSize * 0.5) {
        end = start + sentenceEnd + 1;
      }
    }

    const chunkText = text.slice(start, Math.min(end, text.length)).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, index });
      index++;
    }

    start = end - chunkOverlap;
  }

  return chunks;
}

// ============ 辅助函数 ============

/**
 * 延迟指定毫秒
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 索引配置管理 ============

/** 默认索引配置 */
const DEFAULT_INDEXING_CONFIG: IndexingConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  batchSize: 5,
  batchDelayMs: 1000,
  rateLimitRetryMs: 5000,
};

/** 当前索引配置（内存中） */
let currentIndexingConfig: IndexingConfig = { ...DEFAULT_INDEXING_CONFIG };

/**
 * 获取当前索引配置
 */
export function getIndexingConfig(): IndexingConfig {
  return { ...currentIndexingConfig };
}

/**
 * 设置索引配置
 */
export function setIndexingConfig(config: Partial<IndexingConfig>): void {
  currentIndexingConfig = {
    ...currentIndexingConfig,
    ...config,
  };
  console.log('[KnowledgeIndex] Updated indexing config:', currentIndexingConfig);
}

/**
 * 重置索引配置为默认值
 */
export function resetIndexingConfig(): void {
  currentIndexingConfig = { ...DEFAULT_INDEXING_CONFIG };
  console.log('[KnowledgeIndex] Reset indexing config to defaults');
}

/**
 * 获取默认索引配置
 */
export function getDefaultIndexingConfig(): IndexingConfig {
  return { ...DEFAULT_INDEXING_CONFIG };
}

// ============ 知识索引服务 ============

/**
 * 索引单个笔记
 * 使用批量嵌入以减少 API 调用次数，避免触发速率限制
 */
export async function indexNote(
  noteId: string,
  title: string,
  content: any,
  embeddingService: EmbeddingService,
): Promise<number> {
  const store = getVectorStore();
  const config = currentIndexingConfig;

  // 删除该笔记的旧向量
  store.deleteByNoteId(noteId);

  // 提取文本
  const text = extractNoteText(content);
  if (!text || text.length < 10) {
    console.log(`[KnowledgeIndex] Skipping note ${noteId}: too short`);
    return 0;
  }

  // 使用可配置参数分块
  const chunks = chunkText(text, config.chunkSize, config.chunkOverlap);
  console.log(
    `[KnowledgeIndex] Note ${noteId}: ${chunks.length} chunks (size=${config.chunkSize}, overlap=${config.chunkOverlap})`,
  );

  let indexedCount = 0;

  // 分批处理，使用可配置参数
  for (let i = 0; i < chunks.length; i += config.batchSize) {
    const batchChunks = chunks.slice(i, i + config.batchSize);
    const batchTexts = batchChunks.map((chunk) => chunk.text);

    try {
      // 批量获取向量
      const vectors = await embeddingService.embedBatch(batchTexts);

      // 准备批量插入数据
      const batchItems: Array<{
        id: string;
        embedding: number[];
        metadata: VectorMetadata;
      }> = [];

      for (let j = 0; j < vectors.length; j++) {
        const chunk = batchChunks[j];
        const vector = vectors[j];

        if (vector && vector.length > 0) {
          const vectorId = `${noteId}-${chunk.index}`;
          const metadata: VectorMetadata = {
            noteId,
            noteTitle: title,
            chunkIndex: chunk.index,
            content: chunk.text.slice(0, 200), // 保存前 200 字符用于展示
          };

          batchItems.push({ id: vectorId, embedding: vector, metadata });
          indexedCount++;
        }
      }

      // 批量插入
      if (batchItems.length > 0) {
        store.upsertBatch(batchItems);
      }

      // 如果还有更多批次，添加延迟避免速率限制
      if (i + config.batchSize < chunks.length) {
        await delay(config.batchDelayMs);
      }
    } catch (error) {
      console.error(`[KnowledgeIndex] Failed to embed batch starting at chunk ${i}:`, error);
      // 如果遇到速率限制错误，增加延迟后重试
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('RPM') || errorMsg.includes('rate')) {
        console.log(
          `[KnowledgeIndex] Rate limited, waiting ${config.rateLimitRetryMs}ms before retry...`,
        );
        await delay(config.rateLimitRetryMs);
        i -= config.batchSize; // 回退重试当前批次
      }
    }
  }

  return indexedCount;
}

/**
 * 重建所有笔记索引
 */
export async function rebuildAllIndex(): Promise<{
  success: boolean;
  indexedNotes: number;
  totalVectors: number;
  error?: string;
}> {
  try {
    const config = await readKnowledgeConfig();
    if (!config?.enabled || !config.embedding) {
      return { success: false, indexedNotes: 0, totalVectors: 0, error: '知识库未启用或未配置' };
    }

    const embeddingService = createEmbeddingService(config.embedding);
    const store = getVectorStore();

    // 清空现有索引
    store.clear();

    // 获取所有笔记
    const notes = await storageManager.listNotes();
    console.log(`[KnowledgeIndex] Starting index of ${notes.length} notes`);

    let indexedNotes = 0;
    let totalVectors = 0;

    for (const noteIndex of notes) {
      try {
        const note = await storageManager.getNote(noteIndex.id);
        const count = await indexNote(note.id, note.title, note.content, embeddingService);
        if (count > 0) {
          indexedNotes++;
          totalVectors += count;
        }
      } catch (error) {
        console.error(`[KnowledgeIndex] Failed to index note ${noteIndex.id}:`, error);
      }
    }

    console.log(`[KnowledgeIndex] Completed: ${indexedNotes} notes, ${totalVectors} vectors`);
    return { success: true, indexedNotes, totalVectors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[KnowledgeIndex] Rebuild failed:', msg);
    return { success: false, indexedNotes: 0, totalVectors: 0, error: msg };
  }
}

/**
 * 语义搜索
 */
export async function semanticSearch(
  query: string,
  topK: number = 3,
): Promise<KnowledgeSearchResult[]> {
  try {
    const config = await readKnowledgeConfig();
    if (!config?.enabled || !config.embedding) {
      return [];
    }

    const embeddingService = createEmbeddingService(config.embedding);
    const store = getVectorStore();

    // 获取查询向量
    const queryVector = await embeddingService.embed(query);

    // 搜索
    const results = store.search(queryVector, topK);

    // 转换为面向 UI 的结果
    return results.map((r) => ({
      noteId: r.noteId,
      noteTitle: r.noteTitle || '无标题',
      excerpt: r.content,
      score: r.score,
    }));
  } catch (error) {
    console.error('[KnowledgeIndex] Search failed:', error);
    return [];
  }
}

/**
 * 获取索引统计
 */
export function getIndexStats(): {
  enabled: boolean;
  indexedNotes: number;
  totalVectors: number;
} {
  try {
    const store = getVectorStore();
    const stats = store.getStats();

    // 同步读取配置（简化实现）
    // 这里不再依赖异步读取，直接返回统计
    return {
      enabled: true, // 调用方会检查配置
      indexedNotes: stats.uniqueNotes,
      totalVectors: stats.totalVectors,
    };
  } catch {
    return { enabled: false, indexedNotes: 0, totalVectors: 0 };
  }
}

/**
 * 删除单个笔记的索引
 */
export function deleteNoteFromIndex(noteId: string): number {
  const store = getVectorStore();
  return store.deleteByNoteId(noteId);
}

/**
 * 重新索引单个笔记
 */
export async function reindexNote(noteId: string): Promise<{
  success: boolean;
  vectorCount: number;
  error?: string;
}> {
  try {
    const config = await readKnowledgeConfig();
    if (!config?.enabled || !config.embedding) {
      return { success: false, vectorCount: 0, error: '知识库未启用或未配置' };
    }

    const note = await storageManager.getNote(noteId);
    if (!note) {
      return { success: false, vectorCount: 0, error: '笔记不存在' };
    }

    const embeddingService = createEmbeddingService(config.embedding);
    const count = await indexNote(noteId, note.title, note.content, embeddingService);

    return { success: true, vectorCount: count };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, vectorCount: 0, error: msg };
  }
}

/**
 * 增量更新索引
 * 检测变更的笔记并仅更新这些笔记的索引
 */
export async function incrementalUpdate(): Promise<{
  success: boolean;
  updated: number;
  added: number;
  removed: number;
  totalVectors: number;
  error?: string;
}> {
  try {
    const config = await readKnowledgeConfig();
    if (!config?.enabled || !config.embedding) {
      return {
        success: false,
        updated: 0,
        added: 0,
        removed: 0,
        totalVectors: 0,
        error: '知识库未启用或未配置',
      };
    }

    const embeddingService = createEmbeddingService(config.embedding);
    const store = getVectorStore();

    // 获取当前所有笔记
    const allNotes = await storageManager.listNotes();
    const noteMap = new Map(allNotes.map((n) => [n.id, n]));

    // 获取已索引的笔记列表
    const indexedNotes = store.getNoteIndexList?.() ?? [];
    const indexedMap = new Map(indexedNotes.map((n) => [n.noteId, n]));

    let updated = 0;
    let added = 0;
    let removed = 0;

    // 1. 检测需要删除的索引（已删除的笔记）
    for (const indexed of indexedNotes) {
      if (!noteMap.has(indexed.noteId)) {
        store.deleteByNoteId(indexed.noteId);
        removed++;
        console.log(`[IncrementalUpdate] Removed index for deleted note ${indexed.noteId}`);
      }
    }

    // 2. 检测需要新增/更新的笔记
    for (const noteIndex of allNotes) {
      const indexed = indexedMap.get(noteIndex.id);

      // 如果笔记更新时间晚于索引时间，或未被索引，则重新索引
      const needsUpdate =
        !indexed || (indexed.lastIndexedAt && noteIndex.updatedAt > indexed.lastIndexedAt);

      if (needsUpdate) {
        try {
          const note = await storageManager.getNote(noteIndex.id);
          const count = await indexNote(note.id, note.title, note.content, embeddingService);
          if (count > 0) {
            if (indexed) {
              updated++;
              console.log(`[IncrementalUpdate] Updated note ${noteIndex.id}: ${count} vectors`);
            } else {
              added++;
              console.log(`[IncrementalUpdate] Added note ${noteIndex.id}: ${count} vectors`);
            }
          }
        } catch (error) {
          console.error(`[IncrementalUpdate] Failed to index note ${noteIndex.id}:`, error);
        }
      }
    }

    const stats = store.getStats();
    console.log(`[IncrementalUpdate] Completed: +${added} ~${updated} -${removed}`);

    return {
      success: true,
      updated,
      added,
      removed,
      totalVectors: stats.totalVectors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[IncrementalUpdate] Failed:', msg);
    return { success: false, updated: 0, added: 0, removed: 0, totalVectors: 0, error: msg };
  }
}

// ============ 专家功能：系统诊断与修复 ============

/**
 * 运行系统诊断
 */
export async function runDiagnostics(): Promise<DiagnosticsResult> {
  const store = getVectorStore();
  const config = await readKnowledgeConfig();

  // 获取数据库诊断
  const dbDiag = store.getDiagnostics?.() ?? {
    path: 'unknown',
    sizeBytes: 0,
    journalMode: 'unknown',
    integrity: 'error' as const,
    integrityMessage: 'getDiagnostics not supported',
    dimension: 0,
    tableExists: false,
  };

  // 获取统计信息
  const stats = store.getStats();

  // 检查索引一致性
  let orphanedVectors = 0;
  let missingIndexNotes = 0;
  const inconsistentNotes: string[] = [];

  try {
    // 获取所有笔记 ID
    const allNotes = await storageManager.listNotes();
    const noteIds = allNotes.map((n) => n.id);
    const noteIdSet = new Set(noteIds);

    // 检查孤立向量
    orphanedVectors = store.getOrphanedVectorCount?.(noteIds) ?? 0;

    // 检查缺失索引的笔记
    const indexedNotes = store.getNoteIndexList?.() ?? [];
    const indexedNoteIdSet = new Set(indexedNotes.map((n) => n.noteId));

    for (const noteInfo of allNotes) {
      if (!indexedNoteIdSet.has(noteInfo.id)) {
        // 检查笔记内容是否足够长（与 indexNote 逻辑一致）
        try {
          const note = await storageManager.getNote(noteInfo.id);
          const text = extractNoteText(note.content);
          // 只有内容足够长的笔记才算"缺失索引"
          if (text && text.length >= 10) {
            missingIndexNotes++;
            if (inconsistentNotes.length < 10) {
              inconsistentNotes.push(noteInfo.id);
            }
          }
        } catch {
          // 如果无法读取笔记，也计入缺失
          missingIndexNotes++;
          if (inconsistentNotes.length < 10) {
            inconsistentNotes.push(noteInfo.id);
          }
        }
      }
    }

    // 也记录孤立的笔记 ID
    for (const indexed of indexedNotes) {
      if (!noteIdSet.has(indexed.noteId) && inconsistentNotes.length < 10) {
        inconsistentNotes.push(indexed.noteId);
      }
    }
  } catch (error) {
    console.error('[Diagnostics] Failed to check consistency:', error);
  }

  return {
    database: {
      path: dbDiag.path,
      sizeBytes: dbDiag.sizeBytes,
      journalMode: dbDiag.journalMode,
      integrity: dbDiag.integrity,
      integrityMessage: dbDiag.integrityMessage,
    },
    vectorStore: {
      dimension: dbDiag.dimension,
      totalVectors: stats.totalVectors,
      uniqueNotes: stats.uniqueNotes,
      tableExists: dbDiag.tableExists,
    },
    indexConsistency: {
      orphanedVectors,
      missingIndexNotes,
      inconsistentNotes,
    },
    embeddingConfig: {
      configured: !!config?.embedding?.baseURL && !!config?.embedding?.model,
      provider: config?.embedding?.provider,
      model: config?.embedding?.model,
      lastTestResult: 'unknown',
    },
  };
}

/**
 * 修复索引不一致问题
 */
export async function repairIndex(): Promise<RepairResult> {
  try {
    const config = await readKnowledgeConfig();
    if (!config?.enabled || !config.embedding) {
      return {
        success: false,
        orphanedCleaned: 0,
        missingIndexed: 0,
        error: '知识库未启用或未配置',
      };
    }

    const store = getVectorStore();
    const embeddingService = createEmbeddingService(config.embedding);

    // 获取所有笔记 ID
    const allNotes = await storageManager.listNotes();
    const noteIds = allNotes.map((n) => n.id);

    // 1. 清理孤立向量
    const orphanedCleaned = store.cleanupOrphanedVectors?.(noteIds) ?? 0;

    // 2. 索引缺失的笔记
    const indexedNotes = store.getNoteIndexList?.() ?? [];
    const indexedNoteIdSet = new Set(indexedNotes.map((n) => n.noteId));

    let missingIndexed = 0;
    for (const noteInfo of allNotes) {
      if (!indexedNoteIdSet.has(noteInfo.id)) {
        try {
          const note = await storageManager.getNote(noteInfo.id);
          const count = await indexNote(note.id, note.title, note.content, embeddingService);
          if (count > 0) {
            missingIndexed++;
            console.log(`[RepairIndex] Indexed missing note ${note.id}: ${count} vectors`);
          }
        } catch (error) {
          console.error(`[RepairIndex] Failed to index note ${noteInfo.id}:`, error);
        }
      }
    }

    console.log(
      `[RepairIndex] Completed: cleaned ${orphanedCleaned} orphaned, indexed ${missingIndexed} missing`,
    );

    return {
      success: true,
      orphanedCleaned,
      missingIndexed,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[RepairIndex] Failed:', msg);
    return {
      success: false,
      orphanedCleaned: 0,
      missingIndexed: 0,
      error: msg,
    };
  }
}
