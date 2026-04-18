import type { ChatPayload } from '../../src/services/aiConfig';
import type { AIArtifact } from '../../src/services/types';
import { semanticSearch } from '../knowledge';
import { storageManager } from '../storage';

export type RetrievalStrategy = 'disabled' | 'tool-only' | 'prefetch' | 'hybrid';

export interface RetrievalOrchestratorInput {
  message: string;
  allowActiveRetrieval: boolean;
  supportsToolCalling: boolean;
  existingRagContext?: ChatPayload['ragContext'];
}

export interface RetrievalOrchestratorResult {
  strategy: RetrievalStrategy;
  ragContext?: ChatPayload['ragContext'];
  queries: string[];
  summary: string;
  artifacts: AIArtifact[];
}

type RetrievalRow = {
  noteId: string;
  noteTitle: string;
  excerpt: string;
  score: number;
  source: 'knowledge' | 'notes';
};

const MAX_RESULTS = 5;

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function normalizeScore(score: number | undefined): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(score)));
}

function createArtifact(args: {
  type: AIArtifact['type'];
  title: string;
  summary?: string;
  data?: unknown;
}): AIArtifact {
  return {
    id: `artifact_${Math.random().toString(16).slice(2, 10)}`,
    type: args.type,
    title: args.title,
    summary: args.summary,
    data: args.data,
    createdAt: Date.now(),
  };
}

function shouldUseHybridPrefetch(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }

  return /(知识库|便签|笔记|资料|根据.*(资料|便签)|回顾|总结.*(历史|便签)|检索)/i.test(normalized);
}

function buildQueryCandidates(message: string): string[] {
  const normalized = message.trim();
  if (!normalized) {
    return [];
  }

  const queries: string[] = [normalized];

  const tokenCandidates = normalized
    .replace(/[\r\n]+/g, ' ')
    .split(/[\s,，。！？!?:：;；、/|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  if (tokenCandidates.length > 0) {
    const compact = tokenCandidates.slice(0, 8).join(' ');
    if (compact && compact !== normalized) {
      queries.push(compact);
    }
  }

  return [...new Set(queries)].slice(0, 2);
}

function computeLexicalScore(query: string, title: string, excerpt: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  const titleText = title.toLowerCase();
  const excerptText = excerpt.toLowerCase();
  const tokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  if (titleText.includes(normalizedQuery)) {
    return 0.95;
  }

  if (excerptText.includes(normalizedQuery)) {
    return 0.85;
  }

  if (tokens.length === 0) {
    return 0;
  }

  let hitCount = 0;
  for (const token of tokens) {
    if (titleText.includes(token) || excerptText.includes(token)) {
      hitCount += 1;
    }
  }

  if (hitCount === 0) {
    return 0;
  }

  return Math.min(0.8, 0.45 + (hitCount / tokens.length) * 0.35);
}

async function searchKnowledgeByQueries(queries: string[]): Promise<RetrievalRow[]> {
  const rows: RetrievalRow[] = [];

  for (const query of queries) {
    const results = await semanticSearch(query, 3);
    for (const result of results) {
      rows.push({
        noteId: result.noteId,
        noteTitle: result.noteTitle,
        excerpt: truncateText(result.excerpt, 600),
        score: normalizeScore(result.score),
        source: 'knowledge',
      });
    }
  }

  return rows;
}

async function searchNotesByQueries(queries: string[]): Promise<RetrievalRow[]> {
  const notes = await storageManager.notes.list();
  const scored = new Map<string, RetrievalRow>();

  for (const query of queries) {
    for (const note of notes) {
      const score = computeLexicalScore(query, note.title || '', note.excerpt || '');
      if (score <= 0) {
        continue;
      }

      const previous = scored.get(note.id);
      if (!previous || score > previous.score) {
        scored.set(note.id, {
          noteId: note.id,
          noteTitle: note.title || '无标题',
          excerpt: truncateText(note.excerpt || '', 600),
          score,
          source: 'notes',
        });
      }
    }
  }

  return [...scored.values()];
}

function mergeRows(
  existingRows: RetrievalRow[],
  knowledgeRows: RetrievalRow[],
  noteRows: RetrievalRow[],
): RetrievalRow[] {
  const merged = new Map<string, RetrievalRow>();

  for (const row of [...existingRows, ...knowledgeRows, ...noteRows]) {
    const key = row.noteId;
    const current = merged.get(key);

    if (!current || row.score > current.score) {
      merged.set(key, row);
      continue;
    }

    if (!current.excerpt && row.excerpt) {
      merged.set(key, {
        ...current,
        excerpt: row.excerpt,
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

export async function orchestrateRetrieval(
  input: RetrievalOrchestratorInput,
): Promise<RetrievalOrchestratorResult> {
  const baseQueries = buildQueryCandidates(input.message);
  const existingRows: RetrievalRow[] = (input.existingRagContext?.results ?? []).map((result) => ({
    noteId: result.noteId,
    noteTitle: result.noteTitle,
    excerpt: truncateText(result.excerpt, 600),
    score: normalizeScore(result.score),
    source: 'knowledge',
  }));

  if (!input.allowActiveRetrieval) {
    return {
      strategy: 'disabled',
      ragContext: input.existingRagContext,
      queries: baseQueries,
      summary: '主动检索已关闭，本轮不会自动扩展知识上下文。',
      artifacts: [
        createArtifact({
          type: 'retrieval-query',
          title: '检索策略',
          summary: '主动检索关闭',
          data: {
            strategy: 'disabled',
            queries: baseQueries,
          },
        }),
      ],
    };
  }

  const strategy: RetrievalStrategy = input.supportsToolCalling
    ? shouldUseHybridPrefetch(input.message)
      ? 'hybrid'
      : 'tool-only'
    : 'prefetch';

  if (strategy === 'tool-only') {
    return {
      strategy,
      ragContext: input.existingRagContext,
      queries: baseQueries,
      summary: '当前模型支持工具调用，优先由模型按需发起检索。',
      artifacts: [
        createArtifact({
          type: 'retrieval-query',
          title: '检索策略',
          summary: '按需检索（tool-only）',
          data: {
            strategy,
            queries: baseQueries,
          },
        }),
      ],
    };
  }

  let knowledgeRows: RetrievalRow[] = [];
  let noteRows: RetrievalRow[] = [];
  const errors: string[] = [];

  if (baseQueries.length > 0) {
    const [knowledgeResult, noteResult] = await Promise.all([
      searchKnowledgeByQueries(baseQueries)
        .then((rows) => ({ ok: true as const, rows }))
        .catch((error: unknown) => ({
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        })),
      searchNotesByQueries(baseQueries)
        .then((rows) => ({ ok: true as const, rows }))
        .catch((error: unknown) => ({
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        })),
    ]);

    if (knowledgeResult.ok) {
      knowledgeRows = knowledgeResult.rows;
    } else {
      errors.push(`知识库检索失败: ${knowledgeResult.error}`);
    }

    if (noteResult.ok) {
      noteRows = noteResult.rows;
    } else {
      errors.push(`便签检索失败: ${noteResult.error}`);
    }
  }

  const mergedRows = mergeRows(existingRows, knowledgeRows, noteRows);
  const ragContext =
    mergedRows.length > 0
      ? {
          results: mergedRows.map((row) => ({
            noteId: row.noteId,
            noteTitle: row.noteTitle,
            excerpt: row.excerpt,
            score: row.score,
          })),
        }
      : input.existingRagContext;

  const summaryParts = [
    `策略：${strategy}`,
    `查询：${baseQueries.length > 0 ? baseQueries.join(' | ') : '无'}`,
    `结果：${mergedRows.length} 条`,
  ];

  if (errors.length > 0) {
    summaryParts.push(`异常：${errors.join('；')}`);
  }

  return {
    strategy,
    ragContext,
    queries: baseQueries,
    summary: summaryParts.join('；'),
    artifacts: [
      createArtifact({
        type: 'retrieval-query',
        title: '检索查询规划',
        summary: `策略 ${strategy}，共 ${baseQueries.length} 个查询`,
        data: {
          strategy,
          queries: baseQueries,
          errors,
        },
      }),
      createArtifact({
        type: 'retrieval-result',
        title: '检索结果汇总',
        summary: `命中 ${mergedRows.length} 条候选资料`,
        data: {
          results: mergedRows,
        },
      }),
    ],
  };
}
