/**
 * 存储模块类型定义
 */

import type { TipTapJSONContent, NoteColor } from '../../src/services/types';

// ============ 文件夹类型 ============

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  system: boolean;
}

// ============ 便签类型 ============

export interface Note {
  id: string;
  folderId: string;
  title: string;
  content: TipTapJSONContent;
  tags: string[];
  pinned: boolean;
  color?: NoteColor;
  createdAt: number;
  updatedAt: number;
}

export interface NoteIndex {
  id: string;
  folderId: string;
  title: string;
  excerpt: string;
  updatedAt: number;
  pinned: boolean;
  tags: string[];
  color?: NoteColor;
}

export interface CreateNotePayload {
  title?: string;
  content?: TipTapJSONContent;
}

// ============ AI 对话类型 ============

export interface AIMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  reasoning?: string; // AI 思考过程（可选）
}

export interface AIConversation {
  id: string;
  title: string;
  excerpt: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean; // 是否是默认对话（系统对话，禁止删除）
}

export interface AIConversationIndex {
  id: string;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

// ============ 存储元数据类型 ============

export interface StorageMeta {
  schemaVersion: number;
  storageId: string;
  createdAt: number;
  initialized?: boolean;
}

export interface HealthCheckResult {
  ok: boolean;
  details?: string;
}

export interface StorageStats {
  folderCount: number;
  noteCount: number;
  dataSize: number;
  lastBackupTime?: number;
}

export interface SetStoragePathOptions {
  migrate?: boolean;
}

// ============ 未来扩展预留 ============

// Todo 功能类型（预留）
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TodoIndex {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: number;
  updatedAt: number;
}
