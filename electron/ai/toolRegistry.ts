import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import type { AIToolApproval } from '../../src/services/types';
import {
  appendMarkdownToTipTapDoc,
  convertMarkdownToTipTap,
  stripThinkBlocks,
} from '../../src/shared/utils/tiptapMarkdown';
import { semanticSearch, extractNoteText } from '../knowledge';
import { storageManager } from '../storage';

const DEFAULT_RESULT_LIMIT = 5;
const MAX_NOTE_CONTENT_LENGTH = 4000;
const MAX_APPROVAL_PREVIEW_LENGTH = 220;

const APPROVAL_REQUIRED_TOOL_NAMES = ['saveToNote', 'appendToNote', 'createManualTask'] as const;

type ApprovalRequiredToolName = (typeof APPROVAL_REQUIRED_TOOL_NAMES)[number];

function truncateText(text: string, maxLength: number = MAX_NOTE_CONTENT_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function summarizePreview(text: string): string | undefined {
  const normalized = text.trim();
  if (!normalized) {
    return undefined;
  }

  return truncateText(normalized.replace(/\n{3,}/g, '\n\n'), MAX_APPROVAL_PREVIEW_LENGTH);
}

function deriveNoteTitle(title: string | undefined, content: string): string {
  const normalizedTitle = title?.trim();
  if (normalizedTitle) {
    return normalizedTitle.slice(0, 80);
  }

  const exported = stripThinkBlocks(content);
  const firstLine = exported
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || 'AI 新建便签').replace(/^[#*\-`>]+/g, '').slice(0, 80);
}

async function resolveDefaultTodoList() {
  const lists = await storageManager.todoLists.getAll();
  return lists.find((list) => list.isDefault) ?? lists[0] ?? null;
}

export function isApprovalRequiredTool(toolName: string): toolName is ApprovalRequiredToolName {
  return (APPROVAL_REQUIRED_TOOL_NAMES as readonly string[]).includes(toolName);
}

export async function buildToolApprovalRequest(args: {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}): Promise<AIToolApproval | null> {
  const { approvalId, toolCallId, toolName, input } = args;
  if (!isApprovalRequiredTool(toolName)) {
    return null;
  }

  switch (toolName) {
    case 'saveToNote': {
      const payload = input as { title?: string; content?: string };
      const title = deriveNoteTitle(payload.title, payload.content ?? '');
      const previewContent = stripThinkBlocks(payload.content ?? '');
      return {
        approvalId,
        toolCallId,
        toolName,
        title: `建议新建便签《${title}》`,
        description: 'AI 想把当前结论沉淀成一条新的便签，保存到默认文件夹。',
        status: 'pending',
        preview: summarizePreview(previewContent),
        targetId: 'default',
        targetLabel: '默认文件夹',
      };
    }
    case 'appendToNote': {
      const payload = input as { noteId: string; content?: string };
      const note = await storageManager.notes.get(payload.noteId);
      const previewContent = stripThinkBlocks(payload.content ?? '');
      return {
        approvalId,
        toolCallId,
        toolName,
        title: `建议追加到便签《${note.title || '无标题'}》`,
        description: 'AI 想把当前生成内容追加到现有便签末尾，保留原有内容。',
        status: 'pending',
        preview: summarizePreview(previewContent),
        targetId: note.id,
        targetLabel: note.title || '无标题',
      };
    }
    case 'createManualTask': {
      const payload = input as { listId?: string; text?: string };
      const todoList = payload.listId
        ? await storageManager.todoLists.get(payload.listId)
        : await resolveDefaultTodoList();
      return {
        approvalId,
        toolCallId,
        toolName,
        title: `建议创建任务“${truncateText(payload.text?.trim() || '未命名任务', 48)}”`,
        description: `AI 想把当前结论落成待办，保存到 ${todoList?.name || '默认任务清单'}。`,
        status: 'pending',
        preview: summarizePreview(payload.text ?? ''),
        targetId: todoList?.id,
        targetLabel: todoList?.name || '默认任务清单',
      };
    }
    default:
      return null;
  }
}

export function buildToolExecutionSummary(toolName: string, output: unknown): string | undefined {
  if (!output || typeof output !== 'object') {
    return undefined;
  }

  const payload = output as Record<string, unknown>;

  switch (toolName) {
    case 'saveToNote':
      return `已新建便签《${String(payload.title || '无标题')}》`;
    case 'appendToNote':
      return `已追加到便签《${String(payload.title || '无标题')}》`;
    case 'createManualTask':
      return `已在 ${String(payload.listName || '任务清单')} 中创建任务`;
    default:
      return undefined;
  }
}

export function createAgentTools(options?: { allowActiveRetrieval?: boolean }): ToolSet {
  const allowActiveRetrieval = options?.allowActiveRetrieval ?? true;

  return {
    ...(allowActiveRetrieval
      ? {
          getNote: tool({
            description: '读取指定便签的标题、摘要和正文内容，适合用户明确提到某条便签时使用。',
            inputSchema: z.object({
              noteId: z.string().describe('便签 ID'),
            }),
            execute: async ({ noteId }) => {
              const note = await storageManager.notes.get(noteId);
              const textContent = extractNoteText(note.content);

              return {
                noteId: note.id,
                title: note.title || '无标题',
                content: truncateText(textContent),
                updatedAt: note.updatedAt,
              };
            },
          }),
          searchNotes: tool({
            description: '按关键词搜索本地便签标题和摘要，适合先找相关便签再决定是否读取全文。',
            inputSchema: z.object({
              query: z.string().min(1).describe('搜索关键词'),
              limit: z.number().int().min(1).max(10).optional().describe('最多返回几条结果'),
            }),
            execute: async ({ query, limit = DEFAULT_RESULT_LIMIT }) => {
              const normalizedQuery = query.trim().toLowerCase();
              const notes = await storageManager.notes.list();

              const matches = notes
                .filter((note) => {
                  const title = (note.title || '').toLowerCase();
                  const excerpt = (note.excerpt || '').toLowerCase();
                  return title.includes(normalizedQuery) || excerpt.includes(normalizedQuery);
                })
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, limit)
                .map((note) => ({
                  noteId: note.id,
                  title: note.title || '无标题',
                  excerpt: note.excerpt || '',
                  updatedAt: note.updatedAt,
                }));

              return {
                query,
                count: matches.length,
                results: matches,
              };
            },
          }),
          searchKnowledge: tool({
            description: '对本地知识库做语义检索，适合需要跨便签查资料时使用。',
            inputSchema: z.object({
              query: z.string().min(1).describe('检索问题或关键词'),
              topK: z.number().int().min(1).max(8).optional().describe('返回结果数'),
            }),
            execute: async ({ query, topK = 3 }) => {
              const results = await semanticSearch(query, topK);

              return {
                query,
                count: results.length,
                results: results.map((result) => ({
                  noteId: result.noteId,
                  noteTitle: result.noteTitle,
                  excerpt: truncateText(result.excerpt, 500),
                  score: result.score,
                })),
              };
            },
          }),
        }
      : {}),
    listTodoLists: tool({
      description: '读取当前所有任务清单，适合回答任务组织结构相关问题。',
      inputSchema: z.object({}),
      execute: async () => {
        const lists = await storageManager.todoLists.getAll();
        return {
          count: lists.length,
          lists: lists.map((list) => ({
            id: list.id,
            name: list.name,
            isDefault: list.isDefault,
            updatedAt: list.updatedAt,
          })),
        };
      },
    }),
    listManualTasks: tool({
      description: '读取某个任务清单下的手动任务，适合用户提到待办推进时使用。',
      inputSchema: z.object({
        listId: z.string().describe('任务清单 ID'),
        limit: z.number().int().min(1).max(30).optional().describe('最多返回几条任务'),
      }),
      execute: async ({ listId, limit = 20 }) => {
        const tasks = await storageManager.manualTasks.getAllByListId(listId);

        return {
          listId,
          count: tasks.length,
          tasks: tasks.slice(0, limit).map((task) => ({
            id: task.id,
            text: task.text,
            checked: task.checked,
            dueDate: task.dueDate,
            updatedAt: task.updatedAt,
          })),
        };
      },
    }),
    saveToNote: tool({
      description: '将当前结论沉淀成一条新便签。适合用户明确要求保存总结、方案、纪要时使用。',
      inputSchema: z.object({
        title: z.string().optional().describe('新便签标题'),
        content: z.string().min(1).describe('要保存的便签正文'),
      }),
      needsApproval: true,
      execute: async ({ title, content }) => {
        const exported = stripThinkBlocks(content);
        const finalTitle = deriveNoteTitle(title, exported);
        const note = await storageManager.notes.createNote('default', {
          title: finalTitle,
          content: convertMarkdownToTipTap(exported),
        });

        return {
          noteId: note.id,
          title: note.title,
          folderId: note.folderId,
        };
      },
    }),
    appendToNote: tool({
      description: '把当前结论追加到现有便签末尾。适合用户明确要求把结果追加回某条便签时使用。',
      inputSchema: z.object({
        noteId: z.string().describe('目标便签 ID'),
        content: z.string().min(1).describe('要追加的内容'),
      }),
      needsApproval: true,
      execute: async ({ noteId, content }) => {
        const note = await storageManager.notes.get(noteId);
        const exported = stripThinkBlocks(content);
        const updated = await storageManager.notes.update(noteId, {
          content: appendMarkdownToTipTapDoc(note.content, exported),
        });

        return {
          noteId: updated.id,
          title: updated.title,
          appendedLength: exported.length,
        };
      },
    }),
    createManualTask: tool({
      description: '创建一条待办任务。适合把结论落成下一步动作时使用。',
      inputSchema: z.object({
        listId: z.string().optional().describe('任务清单 ID，不传时默认使用默认清单'),
        text: z.string().min(1).describe('任务内容'),
        dueDate: z.number().optional().describe('截止时间的时间戳（毫秒）'),
      }),
      needsApproval: true,
      execute: async ({ listId, text, dueDate }) => {
        const targetList = listId
          ? await storageManager.todoLists.get(listId)
          : await resolveDefaultTodoList();

        if (!targetList) {
          throw new Error('未找到可用的任务清单');
        }

        const nextOrder = await storageManager.manualTasks.getNextOrder(targetList.id);
        const task = await storageManager.manualTasks.create({
          listId: targetList.id,
          text: text.trim(),
          dueDate,
          order: nextOrder,
          checked: false,
        });

        return {
          taskId: task.id,
          listId: targetList.id,
          listName: targetList.name,
          text: task.text,
        };
      },
    }),
  };
}
