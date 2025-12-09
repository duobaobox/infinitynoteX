/**
 * 测试工具函数
 * 提供 mock 工厂、断言辅助等
 */

import { vi } from 'vitest';
import type { Note, Folder, AIConversation, AIMessage } from '../../electron/storage/schemas';

/**
 * 创建模拟 Folder 数据
 */
export function createMockFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'folder-test-1',
    name: 'Test Folder',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0,
    system: false,
    ...overrides,
  };
}

/**
 * 创建模拟 Note 数据
 */
export function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-test-1',
    folderId: 'folder-test-1',
    title: 'Test Note',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] }],
    },
    tags: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * 创建模拟 AIMessage 数据
 */
export function createMockAIMessage(overrides: Partial<AIMessage> = {}): AIMessage {
  return {
    id: 'msg-test-1',
    role: 'user',
    content: 'Test message',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * 创建模拟 AIConversation 数据
 */
export function createMockConversation(overrides: Partial<AIConversation> = {}): AIConversation {
  return {
    id: 'conv-test-1',
    title: 'Test Conversation',
    excerpt: 'Test excerpt',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重置所有 mock
 */
export function resetAllMocks(): void {
  vi.clearAllMocks();
}
