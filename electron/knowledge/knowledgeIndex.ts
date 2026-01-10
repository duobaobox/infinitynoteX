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

// ============ TipTap JSON 类型定义 ============

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
  [key: string]: unknown;
}

// ============ TipTap JSON 转文本 ============

/**
 * 递归提取 TipTap JSON 转换为 Markdown 文本
 * 优化：保留语义标记，提升向量检索效果
 *
 * 支持的节点类型：
 * - 文本样式: bold, code, underline, strike, highlight, subscript, superscript
 * - 块元素: heading, paragraph, codeBlock, blockquote, hardBreak, horizontalRule
 * - 列表: bulletList, orderedList, listItem, taskList, taskItem
 * - 表格: table, tableRow, tableCell, tableHeader
 * - 链接和图片: link, image
 */
function extractTextFromTipTap(node: TipTapNode | null | undefined): string {
  if (!node) return '';

  // ============ 文本节点 ============
  if (node.type === 'text' && typeof node.text === 'string') {
    let text = node.text;

    if (node.marks && Array.isArray(node.marks)) {
      // 粗体：重点内容
      if (node.marks.some((m) => m.type === 'bold')) {
        text = `**${text}**`;
      }
      // 行内代码：技术术语
      if (node.marks.some((m) => m.type === 'code')) {
        text = `\`${text}\``;
      }
      // 删除线：保留（可能是重要的对比信息）
      if (node.marks.some((m) => m.type === 'strike')) {
        text = `~~${text}~~`;
      }
      // 其他标记（斜体、下划线、高亮、上下标）对检索帮助不大，不保留
    }
    return text;
  }

  // ============ 块级元素 ============

  // 标题
  if (node.type === 'heading') {
    const level = (node.attrs?.level as number) || 1;
    const headingText = Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('')
      : '';
    return `\n\n${'#'.repeat(level)} ${headingText}\n\n`;
  }

  // 代码块
  if (node.type === 'codeBlock') {
    const lang = (node.attrs?.language as string) || '';
    const code = Array.isArray(node.content) ? node.content.map((c) => c.text || '').join('') : '';
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  }

  // 引用块
  if (node.type === 'blockquote') {
    const quoteText = Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('')
      : '';
    return `\n> ${quoteText.trim()}\n`;
  }

  // 硬换行
  if (node.type === 'hardBreak') {
    return '\n';
  }

  // 水平线
  if (node.type === 'horizontalRule') {
    return '\n---\n';
  }

  // ============ 列表元素 ============

  // 无序列表项
  if (node.type === 'listItem') {
    const itemText = Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('').trim()
      : '';
    return `- ${itemText}\n`;
  }

  // 任务列表项
  if (node.type === 'taskItem') {
    const checked = node.attrs?.checked || false;
    const itemText = Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('').trim()
      : '';
    return `- [${checked ? 'x' : ' '}] ${itemText}\n`;
  }

  // ============ 表格元素 ============

  // 表格
  if (node.type === 'table') {
    const rows = Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('')
      : '';
    return `\n${rows}\n`;
  }

  // 表格行
  if (node.type === 'tableRow') {
    const cells = Array.isArray(node.content) ? node.content.map(extractTextFromTipTap) : [];
    return `| ${cells.join(' | ')} |\n`;
  }

  // 表格单元格
  if (node.type === 'tableCell' || node.type === 'tableHeader') {
    return Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('').trim()
      : '';
  }

  // ============ 内联元素 ============

  // 链接（仅保留文本，不保留 URL）
  if (node.type === 'link') {
    const linkText = Array.isArray(node.content)
      ? node.content.map(extractTextFromTipTap).join('')
      : '';
    // 可选：保留 URL（如果对检索有帮助）
    // const url = node.attrs?.href || '';
    // return `[${linkText}](${url})`;
    return linkText;
  }

  // 图片（提取 alt 文本和标题）
  if (node.type === 'image') {
    const alt = (node.attrs?.alt as string) || '';
    const title = (node.attrs?.title as string) || '';
    // 保留图片描述信息，帮助检索
    if (alt || title) {
      return `[图片: ${alt || title}] `;
    }
    return '';
  }

  // ============ 容器元素递归处理 ============

  if (Array.isArray(node.content)) {
    const texts = node.content.map(extractTextFromTipTap);

    // 块级容器添加换行
    const blockTypes = ['paragraph', 'doc', 'bulletList', 'orderedList', 'taskList'];

    if (blockTypes.includes(node.type)) {
      return texts.join('') + '\n';
    }

    return texts.join('');
  }

  return '';
}

/**
 * 从笔记内容提取 Markdown 文本
 *
 * 注意：TipTap 的 Markdown 扩展需要 Editor 实例，无法在 Electron 后端直接使用。
 * 因此这里使用优化后的手动转换器，保留关键的 Markdown 标记，提升向量检索效果。
 */
export function extractNoteText(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  const text = extractTextFromTipTap(content as TipTapNode);
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
 * 优化：智能边界检测，避免截断重要结构
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

    // 尝试在更智能的边界切分
    if (end < text.length) {
      const searchRange = Math.min(100, chunkSize * 0.3); // 在 30% 范围内寻找边界
      const slice = text.slice(start, end + searchRange);

      // 优先级1: 双换行（段落边界）
      const paragraphEnd = slice.lastIndexOf('\n\n');
      if (paragraphEnd > chunkSize * 0.5) {
        end = start + paragraphEnd + 2;
      } else {
        // 优先级2: 句子边界（更完善的标点检测）
        const sentenceRegex = /[。！？.!?]["']?\s+/g;
        let lastSentenceEnd = -1;
        let match;

        while ((match = sentenceRegex.exec(slice)) !== null) {
          if (match.index > chunkSize * 0.5 && match.index <= chunkSize) {
            lastSentenceEnd = match.index + match[0].length;
          }
        }

        if (lastSentenceEnd > 0) {
          end = start + lastSentenceEnd;
        } else {
          // 优先级3: 单换行或逗号
          const lineEnd = slice.lastIndexOf('\n', chunkSize);
          const commaEnd = slice.lastIndexOf('，', chunkSize);
          const fallbackEnd = Math.max(lineEnd, commaEnd);

          if (fallbackEnd > chunkSize * 0.5) {
            end = start + fallbackEnd + 1;
          }
        }
      }
    }

    const chunkText = text.slice(start, Math.min(end, text.length)).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, index });
      index++;
    }

    start = end - chunkOverlap;

    // 防止死循环：如果没有前进，强制前进
    if (start <= chunks[chunks.length - 1]?.text.length || start >= text.length) {
      start = end;
    }
  }

  return chunks;
}

// ============ 辅助函数 ============

import crypto from 'node:crypto';

/**
 * 计算内容的 MD5 Hash（用于变更检测）
 */
function computeHash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

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
  content: unknown,
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
        } else {
          console.warn(`[KnowledgeIndex] Empty vector for chunk ${chunk.index}, skipping`);
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
      } else if (batchTexts.length > 1) {
        // 非速率限制错误：降级为单个处理（错误隔离）
        console.log(`[KnowledgeIndex] Batch failed, falling back to individual processing...`);
        for (let j = 0; j < batchChunks.length; j++) {
          try {
            const chunk = batchChunks[j];
            const vector = await embeddingService.embed(chunk.text);
            if (vector && vector.length > 0) {
              const vectorId = `${noteId}-${chunk.index}`;
              const metadata: VectorMetadata = {
                noteId,
                noteTitle: title,
                chunkIndex: chunk.index,
                content: chunk.text.slice(0, 200),
              };
              store.upsert(vectorId, vector, metadata);
              indexedCount++;
            }
          } catch (singleError) {
            console.error(
              `[KnowledgeIndex] Failed to embed single chunk ${batchChunks[j].index}:`,
              singleError,
            );
          }
        }
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
    const notes = await storageManager.notes.list();
    console.log(`[KnowledgeIndex] Starting index of ${notes.length} notes`);

    let indexedNotes = 0;
    let totalVectors = 0;

    for (const noteIndex of notes) {
      try {
        const note = await storageManager.notes.get(noteIndex.id);
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
 * 语义搜索（使用混合搜索：向量 + 关键词 + RRF 融合）
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

    // 使用混合搜索（如果支持），否则回退到纯向量搜索
    let results;
    if (store.hybridSearch) {
      results = store.hybridSearch(queryVector, query, topK);
      console.log(`[KnowledgeIndex] Using hybrid search for query: "${query}"`);
    } else {
      results = store.search(queryVector, topK);
      console.log(`[KnowledgeIndex] Using vector-only search for query: "${query}"`);
    }

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
 * 重新索引单个笔记（使用智能增量更新）
 */
export async function reindexNote(noteId: string): Promise<{
  success: boolean;
  vectorCount: number;
  unchanged?: number;
  error?: string;
}> {
  try {
    const config = await readKnowledgeConfig();
    if (!config?.enabled || !config.embedding) {
      return { success: false, vectorCount: 0, error: '知识库未启用或未配置' };
    }

    const note = await storageManager.notes.get(noteId);
    if (!note) {
      return { success: false, vectorCount: 0, error: '笔记不存在' };
    }

    const embeddingService = createEmbeddingService(config.embedding);
    const result = await smartIndexNote(noteId, note.title, note.content, embeddingService);

    return {
      success: true,
      vectorCount: result.embedded,
      unchanged: result.unchanged,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, vectorCount: 0, error: msg };
  }
}

/**
 * 智能索引单个笔记（增量更新）
 * 通过 chunk 级别的 hash 比对，仅对真正变化的内容重新调用 Embedding API
 */
export async function smartIndexNote(
  noteId: string,
  title: string,
  content: unknown,
  embeddingService: EmbeddingService,
): Promise<{
  embedded: number;
  unchanged: number;
  deleted: number;
}> {
  const store = getVectorStore();
  const config = currentIndexingConfig;

  // 提取文本
  const text = extractNoteText(content);
  if (!text || text.length < 10) {
    // 内容太短，删除所有现有索引
    const deleted = store.deleteByNoteId(noteId);
    console.log(`[SmartIndex] Note ${noteId}: too short, deleted ${deleted} vectors`);
    return { embedded: 0, unchanged: 0, deleted };
  }

  // 分块并计算 hash
  const newChunks = chunkText(text, config.chunkSize, config.chunkOverlap).map((chunk) => ({
    ...chunk,
    hash: computeHash(chunk.text),
  }));

  // 获取现有索引
  const existingChunks = store.getChunksByNoteId?.(noteId) ?? [];
  const existingMap = new Map(
    existingChunks.map((c) => [c.id, { chunkIndex: c.chunkIndex, hash: c.contentHash }]),
  );

  // 比对差异
  const toEmbed: typeof newChunks = [];
  const toDelete: string[] = [];
  let unchanged = 0;

  // 新 chunks 的 ID 映射
  const newChunkIds = new Set<string>();

  for (const chunk of newChunks) {
    const chunkId = `${noteId}-${chunk.index}`;
    newChunkIds.add(chunkId);

    const existing = existingMap.get(chunkId);
    if (!existing || existing.hash !== chunk.hash) {
      // 需要重新 embedding（新增或内容变化）
      toEmbed.push(chunk);
    } else {
      // hash 相同，跳过
      unchanged++;
    }
  }

  // 检查需要删除的 chunks（旧索引中存在但新内容中不存在）
  for (const [id] of existingMap) {
    if (!newChunkIds.has(id)) {
      toDelete.push(id);
    }
  }

  // 删除不再需要的 chunks
  if (toDelete.length > 0 && store.deleteByIds) {
    store.deleteByIds(toDelete);
  }

  console.log(
    `[SmartIndex] Note ${noteId}: ${toEmbed.length} to embed, ${unchanged} unchanged, ${toDelete.length} deleted`,
  );

  // 如果没有需要 embedding 的 chunks，直接返回
  if (toEmbed.length === 0) {
    return { embedded: 0, unchanged, deleted: toDelete.length };
  }

  let embeddedCount = 0;

  // 分批处理需要 embedding 的 chunks
  for (let i = 0; i < toEmbed.length; i += config.batchSize) {
    const batchChunks = toEmbed.slice(i, i + config.batchSize);
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
            content: chunk.text.slice(0, 200),
            contentHash: chunk.hash, // 保存 hash
          };

          batchItems.push({ id: vectorId, embedding: vector, metadata });
          embeddedCount++;
        }
      }

      // 批量插入
      if (batchItems.length > 0) {
        store.upsertBatch(batchItems);
      }

      // 如果还有更多批次，添加延迟避免速率限制
      if (i + config.batchSize < toEmbed.length) {
        await delay(config.batchDelayMs);
      }
    } catch (error) {
      console.error(`[SmartIndex] Failed to embed batch starting at chunk ${i}:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('RPM') || errorMsg.includes('rate')) {
        console.log(
          `[SmartIndex] Rate limited, waiting ${config.rateLimitRetryMs}ms before retry...`,
        );
        await delay(config.rateLimitRetryMs);
        i -= config.batchSize;
      }
    }
  }

  return { embedded: embeddedCount, unchanged, deleted: toDelete.length };
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
    const allNotes = await storageManager.notes.list();
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
          const note = await storageManager.notes.get(noteIndex.id);
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
    const allNotes = await storageManager.notes.list();
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
          const note = await storageManager.notes.get(noteInfo.id);
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
    const allNotes = await storageManager.notes.list();
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
          const note = await storageManager.notes.get(noteInfo.id);
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
