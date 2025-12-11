/**
 * 知识库索引服务
 * 负责笔记内容提取、分块和向量化
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { storageManager } from './storage';
import { readKnowledgeConfig, createEmbeddingService, type EmbeddingService } from './embedding';
import type { VectorMetadata, KnowledgeSearchResult } from '../src/services/knowledgeTypes';

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

// ============ 内存向量存储（MVP） ============

interface VectorRecord {
  id: string;
  vector: number[];
  metadata: VectorMetadata;
}

/**
 * 内存向量存储（后续可替换为 sqlite-vec）
 */
class InMemoryVectorStore {
  private vectors: VectorRecord[] = [];
  private indexPath: string;

  constructor() {
    this.indexPath = path.join(app.getPath('userData'), 'vector-index.json');
  }

  /**
   * 加载索引（从文件）
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.vectors = JSON.parse(data);
      console.log(`[VectorStore] Loaded ${this.vectors.length} vectors`);
    } catch {
      this.vectors = [];
    }
  }

  /**
   * 保存索引（到文件）
   */
  async save(): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(this.vectors), 'utf-8');
    console.log(`[VectorStore] Saved ${this.vectors.length} vectors`);
  }

  /**
   * 添加或更新向量
   */
  upsert(id: string, vector: number[], metadata: VectorMetadata): void {
    const existing = this.vectors.findIndex((v) => v.id === id);
    if (existing >= 0) {
      this.vectors[existing] = { id, vector, metadata };
    } else {
      this.vectors.push({ id, vector, metadata });
    }
  }

  /**
   * 删除某个笔记的所有向量
   */
  deleteByNoteId(noteId: string): void {
    this.vectors = this.vectors.filter(
      (v) => !(v.metadata.sourceType === 'note' && v.metadata.sourceId === noteId),
    );
  }

  /**
   * 清空所有向量
   */
  clear(): void {
    this.vectors = [];
  }

  /**
   * 余弦相似度搜索
   */
  search(
    queryVector: number[],
    topK: number = 3,
  ): Array<{ metadata: VectorMetadata; score: number }> {
    if (this.vectors.length === 0) {
      return [];
    }

    // 计算所有向量的余弦相似度
    const results = this.vectors.map((record) => ({
      metadata: record.metadata,
      score: cosineSimilarity(queryVector, record.vector),
    }));

    // 按相似度排序
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * 获取统计信息
   */
  getStats(): { totalVectors: number; noteIds: string[] } {
    const noteIds = [
      ...new Set(
        this.vectors
          .filter((v) => v.metadata.sourceType === 'note')
          .map((v) => v.metadata.sourceId),
      ),
    ];
    return {
      totalVectors: this.vectors.length,
      noteIds,
    };
  }
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ============ 知识索引服务 ============

// 单例
let vectorStore: InMemoryVectorStore | null = null;

/**
 * 获取向量存储实例
 */
async function getVectorStore(): Promise<InMemoryVectorStore> {
  if (!vectorStore) {
    vectorStore = new InMemoryVectorStore();
    await vectorStore.load();
  }
  return vectorStore;
}

/**
 * 辅助函数：延迟指定毫秒
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const store = await getVectorStore();

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

      // 存储每个向量
      for (let j = 0; j < vectors.length; j++) {
        const chunk = batchChunks[j];
        const vector = vectors[j];

        if (vector && vector.length > 0) {
          const vectorId = `${noteId}-${chunk.index}`;
          const metadata: VectorMetadata = {
            sourceType: 'note',
            sourceId: noteId,
            content: chunk.text.slice(0, 200), // 保存前 200 字符用于展示
            title,
            chunkIndex: chunk.index,
            createdAt: Date.now(),
          };

          store.upsert(vectorId, vector, metadata);
          indexedCount++;
        }
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
    const store = await getVectorStore();

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

    // 保存索引
    await store.save();

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
    const store = await getVectorStore();

    // 获取查询向量
    const queryVector = await embeddingService.embed(query);

    // 搜索
    const results = store.search(queryVector, topK);

    // 转换为面向 UI 的结果
    return results.map((r) => ({
      noteId: r.metadata.sourceId,
      noteTitle: r.metadata.title || '无标题',
      excerpt: r.metadata.content,
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
export async function getIndexStats(): Promise<{
  enabled: boolean;
  indexedNotes: number;
  totalVectors: number;
}> {
  try {
    const config = await readKnowledgeConfig();
    const store = await getVectorStore();
    const stats = store.getStats();

    return {
      enabled: config?.enabled ?? false,
      indexedNotes: stats.noteIds.length,
      totalVectors: stats.totalVectors,
    };
  } catch {
    return { enabled: false, indexedNotes: 0, totalVectors: 0 };
  }
}
