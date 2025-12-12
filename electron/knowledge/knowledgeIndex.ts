/**
 * 知识库索引服务
 * 负责笔记内容提取、分块和向量化
 * 使用 SQLite-vec 实现高性能向量存储
 */

import { storageManager } from '../storage';
import { readKnowledgeConfig, createEmbeddingService, type EmbeddingService } from './embedding';
import { getVectorStore } from './vectorStore';
import type { VectorMetadata, KnowledgeSearchResult } from './types';

// 重新导出类型
export type { KnowledgeSearchResult } from './types';

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

  // 删除该笔记的旧向量
  store.deleteByNoteId(noteId);

  // 提取文本
  const text = extractNoteText(content);
  if (!text || text.length < 10) {
    console.log(`[KnowledgeIndex] Skipping note ${noteId}: too short`);
    return 0;
  }

  // 分块
  const chunks = chunkText(text);
  console.log(`[KnowledgeIndex] Note ${noteId}: ${chunks.length} chunks`);

  // 批量向量化配置
  const BATCH_SIZE = 5; // 每批处理的 chunk 数量
  const BATCH_DELAY_MS = 1000; // 批次间延迟（毫秒），避免 RPM 限制

  let indexedCount = 0;

  // 分批处理
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
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
      if (i + BATCH_SIZE < chunks.length) {
        await delay(BATCH_DELAY_MS);
      }
    } catch (error) {
      console.error(`[KnowledgeIndex] Failed to embed batch starting at chunk ${i}:`, error);
      // 如果遇到速率限制错误，增加延迟后重试
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('RPM') || errorMsg.includes('rate')) {
        console.log(`[KnowledgeIndex] Rate limited, waiting 5 seconds before retry...`);
        await delay(5000);
        i -= BATCH_SIZE; // 回退重试当前批次
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
