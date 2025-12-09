/**
 * Storage Utils 测试
 * 测试存储模块的工具函数
 */

import { describe, it, expect } from 'vitest';
import { generateId, generateConversationTitle } from '../../../../electron/storage/utils';

describe('generateId', () => {
  it('should generate a hex string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate 16 character string (8 bytes = 16 hex chars)', () => {
    const id = generateId();
    expect(id).toHaveLength(16);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('generateConversationTitle', () => {
  it('should generate title with current time if no timestamp provided', () => {
    const title = generateConversationTitle();
    expect(title).toMatch(/^对话\d{8}-\d{4}$/);
  });

  it('should generate title with provided timestamp', () => {
    // 2024-01-15 14:30:00
    const timestamp = new Date(2024, 0, 15, 14, 30, 0).getTime();
    const title = generateConversationTitle(timestamp);
    expect(title).toBe('对话20240115-1430');
  });

  it('should pad single digit month/day/hour/minute', () => {
    // 2024-03-05 09:05:00
    const timestamp = new Date(2024, 2, 5, 9, 5, 0).getTime();
    const title = generateConversationTitle(timestamp);
    expect(title).toBe('对话20240305-0905');
  });
});
