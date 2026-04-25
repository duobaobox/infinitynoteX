import { describe, expect, it } from 'vitest';

import {
  AI_WORKBENCH_FILTER_ORDER,
  CANVAS_AI_WORKBENCH_ITEM_ID,
  DEFAULT_AI_WORKBENCH_FILTER,
  GLOBAL_AI_WORKBENCH_ITEM_ID,
  buildAIWorkbenchItems,
  getDefaultAIWorkbenchSelectionId,
  normalizeAIWorkbenchSelectionId,
  resolveInitialAIWorkbenchFilter,
  resolveAIWorkbenchSelection,
} from '../../../../src/features/ai-workbench/model/workbenchConversationItems';

describe('workbenchConversationItems', () => {
  it('always exposes global and canvas product entries in AI workbench', () => {
    const items = buildAIWorkbenchItems([]);

    expect(items[0]?.id).toBe(GLOBAL_AI_WORKBENCH_ITEM_ID);
    expect(items[0]?.source).toBe('global');
    expect(items.some((item) => item.id === CANVAS_AI_WORKBENCH_ITEM_ID)).toBe(true);
  });

  it('keeps note and workbench conversations visible in the unified list', () => {
    const items = buildAIWorkbenchItems([
      {
        id: 'wb-1',
        title: '工坊对话',
        excerpt: '这是一个工坊会话',
        createdAt: 10,
        updatedAt: 20,
      },
      {
        id: 'note-1',
        title: '便签 AI',
        excerpt: '来自便签页',
        createdAt: 30,
        updatedAt: 40,
        source: 'note',
        sourceEntityId: 'note-entity-1',
      },
    ]);

    expect(items.some((item) => item.id === 'wb-1' && item.source === 'workbench')).toBe(true);
    expect(items.some((item) => item.id === 'note-1' && item.source === 'note')).toBe(true);
  });

  it('normalizes legacy global selection ids to the stable global entry id', () => {
    const previews = [
      {
        id: 'global-history-1',
        title: '全局历史',
        excerpt: '全局上下文',
        createdAt: 1,
        updatedAt: 2,
        source: 'global' as const,
        sourceEntityId: 'default',
      },
    ];

    expect(normalizeAIWorkbenchSelectionId('global-history-1', previews)).toBe(
      GLOBAL_AI_WORKBENCH_ITEM_ID,
    );

    const resolved = resolveAIWorkbenchSelection(GLOBAL_AI_WORKBENCH_ITEM_ID, previews);
    expect(resolved?.source).toBe('global');
    expect(resolved?.conversationId).toBe('global-history-1');
  });

  it('uses the global entry as the default AI workbench landing selection', () => {
    expect(getDefaultAIWorkbenchSelectionId()).toBe(GLOBAL_AI_WORKBENCH_ITEM_ID);
  });

  it('uses workbench as the default source filter when no local preference exists', () => {
    expect(DEFAULT_AI_WORKBENCH_FILTER).toBe('workbench');
    expect(resolveInitialAIWorkbenchFilter(null)).toBe('workbench');
    expect(resolveInitialAIWorkbenchFilter('invalid-filter')).toBe('workbench');
    expect(resolveInitialAIWorkbenchFilter('all')).toBe('all');
  });

  it('puts the workbench filter first and keeps all at the end', () => {
    expect(AI_WORKBENCH_FILTER_ORDER).toEqual(['workbench', 'global', 'note', 'canvas', 'all']);
  });
});
