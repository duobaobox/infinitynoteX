/**
 * Schema 验证测试
 * 测试 Zod Schema 的数据校验功能
 */

import { describe, it, expect } from 'vitest';
import {
  FolderSchema,
  NoteSchema,
  AIMessageSchema,
  BrowserCardSchema,
} from '../../../../electron/storage/schemas';

describe('FolderSchema', () => {
  it('should validate a valid folder', () => {
    const validFolder = {
      id: 'test-folder-1',
      name: 'Test Folder',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
      system: false,
    };

    const result = FolderSchema.safeParse(validFolder);
    expect(result.success).toBe(true);
  });

  it('should reject folder with missing required fields', () => {
    const invalidFolder = {
      id: 'test-folder-1',
      name: 'Test Folder',
      // missing createdAt, updatedAt, order, system
    };

    const result = FolderSchema.safeParse(invalidFolder);
    expect(result.success).toBe(false);
  });

  it('should reject folder with wrong type', () => {
    const invalidFolder = {
      id: 123, // should be string
      name: 'Test Folder',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0,
      system: false,
    };

    const result = FolderSchema.safeParse(invalidFolder);
    expect(result.success).toBe(false);
  });
});

describe('NoteSchema', () => {
  it('should validate a valid note', () => {
    const validNote = {
      id: 'test-note-1',
      folderId: 'test-folder-1',
      title: 'Test Note',
      content: { type: 'doc', content: [] },
      tags: ['tag1', 'tag2'],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = NoteSchema.safeParse(validNote);
    expect(result.success).toBe(true);
  });

  it('should validate note with optional color', () => {
    const noteWithColor = {
      id: 'test-note-1',
      folderId: 'test-folder-1',
      title: 'Test Note',
      content: {},
      tags: [],
      pinned: true,
      color: 'bae0ff',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = NoteSchema.safeParse(noteWithColor);
    expect(result.success).toBe(true);
  });

  it('should reject invalid color value', () => {
    const noteWithInvalidColor = {
      id: 'test-note-1',
      folderId: 'test-folder-1',
      title: 'Test Note',
      content: {},
      tags: [],
      pinned: false,
      color: 'invalid-color',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = NoteSchema.safeParse(noteWithInvalidColor);
    expect(result.success).toBe(false);
  });
});

describe('AIMessageSchema', () => {
  it('should validate user message', () => {
    const userMessage = {
      role: 'user',
      content: 'Hello AI!',
      timestamp: Date.now(),
    };

    const result = AIMessageSchema.safeParse(userMessage);
    expect(result.success).toBe(true);
  });

  it('should validate assistant message with reasoning', () => {
    const assistantMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello human!',
      timestamp: Date.now(),
      reasoning: 'I should greet the user.',
    };

    const result = AIMessageSchema.safeParse(assistantMessage);
    expect(result.success).toBe(true);
  });

  it('should reject invalid role', () => {
    const invalidMessage = {
      role: 'system', // only 'user' and 'assistant' allowed
      content: 'Hello',
      timestamp: Date.now(),
    };

    const result = AIMessageSchema.safeParse(invalidMessage);
    expect(result.success).toBe(false);
  });
});

describe('BrowserCardSchema', () => {
  it('should validate a valid browser card', () => {
    const validCard = {
      id: 'card-1',
      name: 'Google',
      url: 'https://google.com',
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = BrowserCardSchema.safeParse(validCard);
    expect(result.success).toBe(true);
  });

  it('should validate card with optional fields', () => {
    const cardWithOptional = {
      id: 'card-1',
      name: 'Google',
      url: 'https://google.com',
      icon: 'https://google.com/favicon.ico',
      isBuiltIn: true,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = BrowserCardSchema.safeParse(cardWithOptional);
    expect(result.success).toBe(true);
  });
});
