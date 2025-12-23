/**
 * 数据 Schema 定义
 * 使用 Zod 进行运行时数据校验
 * 所有类型通过 z.infer 从 Schema 推导，确保类型和校验一致
 */

import { z } from 'zod';

// ============ 文件夹 Schema ============

export const FolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  order: z.number(),
  system: z.boolean(),
});

export const FoldersArraySchema = z.array(FolderSchema);

// 从 Schema 推导类型
export type Folder = z.infer<typeof FolderSchema>;

// ============ 便签 Schema ============

export const NoteSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  title: z.string(),
  content: z.any(), // TipTap JSON content，结构复杂，暂不严格校验
  tags: z.array(z.string()),
  pinned: z.boolean(),
  color: z.enum(['bae0ff', 'd9f7be', 'ffd6e7', 'd6e4ff', 'ffd666', 'ffffff']).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const NoteIndexSchema = z.object({
  id: z.string(),
  folderId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  pinned: z.boolean(),
  tags: z.array(z.string()),
  color: z.enum(['bae0ff', 'd9f7be', 'ffd6e7', 'd6e4ff', 'ffd666', 'ffffff']).optional(),
});

export const NotesIndexArraySchema = z.array(NoteIndexSchema);

// 从 Schema 推导类型
export type Note = z.infer<typeof NoteSchema>;
export type NoteIndex = z.infer<typeof NoteIndexSchema>;

// ============ 回收站 Schema ============

export const TrashItemSchema = z.object({
  id: z.string(),
  originalId: z.string(), // 原便签 ID
  originalFolderId: z.string(), // 原所属文件夹 ID
  title: z.string(),
  content: z.any(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  color: z.enum(['bae0ff', 'd9f7be', 'ffd6e7', 'd6e4ff', 'ffd666', 'ffffff']).optional(),
  createdAt: z.number(), // 便签原创建时间
  updatedAt: z.number(), // 便签原更新时间
  deletedAt: z.number(), // 删除时间
  expiresAt: z.number(), // 过期时间（自动永久删除）
});

export const TrashIndexSchema = z.object({
  id: z.string(),
  originalId: z.string(),
  originalFolderId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  deletedAt: z.number(),
  expiresAt: z.number(),
});

export const TrashIndexArraySchema = z.array(TrashIndexSchema);

// 从 Schema 推导类型
export type TrashItem = z.infer<typeof TrashItemSchema>;
export type TrashIndex = z.infer<typeof TrashIndexSchema>;

// 便签操作相关类型（非存储数据，手动定义）
export type CreateNotePayload = {
  title?: string;
  content?: Note['content'];
};

// ============ AI 对话 Schema ============

export const AIMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.number(),
  reasoning: z.string().optional(),
  ragSources: z
    .array(
      z.object({
        key: z.number(),
        title: z.string(),
        description: z.string().optional(),
        noteId: z.string().optional(),
      }),
    )
    .optional(),
});

export const AIConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  messages: z.array(AIMessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AIConversationIndexSchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AIConversationsIndexArraySchema = z.array(AIConversationIndexSchema);

// 从 Schema 推导类型
export type AIMessage = z.infer<typeof AIMessageSchema>;
export type AIConversation = z.infer<typeof AIConversationSchema>;
export type AIConversationIndex = z.infer<typeof AIConversationIndexSchema>;

// ============ 存储元数据 Schema ============

export const StorageMetaSchema = z.object({
  schemaVersion: z.number(),
  storageId: z.string(),
  createdAt: z.number(),
  // 注意：initialized 字段已迁移到 local-state.json（不同步）
});

// 从 Schema 推导类型
export type StorageMeta = z.infer<typeof StorageMetaSchema>;

// ============ 健康检查结果 Schema ============

export const HealthCheckResultSchema = z.object({
  ok: z.boolean(),
  details: z.string().optional(),
});

// 从 Schema 推导类型
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

// ============ 存储统计 Schema ============

export const StorageStatsSchema = z.object({
  folderCount: z.number(),
  noteCount: z.number(),
  dataSize: z.number(),
  lastBackupTime: z.number().optional(),
});

// 从 Schema 推导类型
export type StorageStats = z.infer<typeof StorageStatsSchema>;

// ============ 未来扩展预留 ============

// Todo 功能 Schema（预留，暂未实现）
export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const TodoIndexSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.number().optional(),
  updatedAt: z.number(),
});

// 从 Schema 推导类型（预留）
export type Todo = z.infer<typeof TodoSchema>;
export type TodoIndex = z.infer<typeof TodoIndexSchema>;

// ============ 浏览器卡片 Schema ============

export const BrowserCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  icon: z.string().optional(),
  isBuiltIn: z.boolean().optional(),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const BrowserCardIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  icon: z.string().optional(),
  order: z.number(),
  updatedAt: z.number(),
});

export const BrowserCardsIndexArraySchema = z.array(BrowserCardIndexSchema);

// 从 Schema 推导类型
export type BrowserCard = z.infer<typeof BrowserCardSchema>;
export type BrowserCardIndex = z.infer<typeof BrowserCardIndexSchema>;

// ============ Todo 清单 Schema ============

export const TodoListSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  isDefault: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  order: z.number(),
});

export const TodoListIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  order: z.number(),
  updatedAt: z.number(),
});

export const TodoListsIndexArraySchema = z.array(TodoListIndexSchema);

// 从 Schema 推导类型
export type TodoList = z.infer<typeof TodoListSchema>;
export type TodoListIndex = z.infer<typeof TodoListIndexSchema>;

// ============ 手动任务 Schema ============

export const ManualTaskSchema = z.object({
  id: z.string(),
  listId: z.string(),
  text: z.string(),
  checked: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  order: z.number(),
  dueDate: z.number().optional(),
});

export const ManualTaskIndexSchema = z.object({
  id: z.string(),
  listId: z.string(),
  text: z.string(),
  checked: z.boolean(),
  order: z.number(),
  updatedAt: z.number(),
  dueDate: z.number().optional(),
});

export const ManualTasksIndexArraySchema = z.array(ManualTaskIndexSchema);

// 从 Schema 推导类型
export type ManualTask = z.infer<typeof ManualTaskSchema>;
export type ManualTaskIndex = z.infer<typeof ManualTaskIndexSchema>;
