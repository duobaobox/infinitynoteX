/**
 * AIConversationSlice 测试
 * 测试 AI 对话状态管理逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createAIConversationSlice } from '../../../../src/store/slices/aiConversationSlice';
import { aiConversationService } from '../../../../src/services';
import type { AIConversationSlice } from '../../../../src/store/slices/aiConversationSlice';
import type { UISlice } from '../../../../src/store/slices/uiSlice';
import { createMockConversation } from '../../../utils/testHelpers';

// Mock aiConversationService
vi.mock('../../../../src/services', () => ({
  aiConversationService: {
    getConversations: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
  },
}));

// Mock store setup
interface TestStore extends AIConversationSlice, UISlice {}

const createTestStore = (initialState: Partial<TestStore> = {}) => {
  return createStore<TestStore>((set, get, api) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sliceResult = createAIConversationSlice(set as any, get as any, api as any);

    return {
      // Mock UI Slice 的必要属性
      showEditor: false,
      // 合并 slice 结果
      ...sliceResult,
      // 覆盖状态（用于测试）
      ...initialState,
    } as TestStore;
  });
};

describe('AIConversationSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setAIConversations', () => {
    it('should set conversations list', () => {
      const store = createTestStore();
      const conversations = [createMockConversation({ id: 'c1' })];

      store.getState().setAIConversations(conversations);

      expect(store.getState().aiConversations).toEqual(conversations);
    });
  });

  describe('setSelectedToolItem', () => {
    it('should set selected item and show editor', () => {
      const store = createTestStore();

      store.getState().setSelectedToolItem('c1');

      expect(store.getState().selectedToolItemId).toBe('c1');
      expect(store.getState().showEditor).toBe(true);
    });

    it('should clear selected item and hide editor', () => {
      const store = createTestStore({ selectedToolItemId: 'c1', showEditor: true });

      store.getState().setSelectedToolItem(null);

      expect(store.getState().selectedToolItemId).toBeNull();
      expect(store.getState().showEditor).toBe(false); // implementation sets showEditor: !!itemId
    });
  });

  describe('loadAIConversations', () => {
    it('should load conversations from service', async () => {
      const mockConversations = [createMockConversation({ id: 'c1' })];
      vi.mocked(aiConversationService.getConversations).mockResolvedValue(mockConversations);

      const store = createTestStore();
      await store.getState().loadAIConversations();

      expect(aiConversationService.getConversations).toHaveBeenCalled();
      expect(store.getState().aiConversations).toEqual(mockConversations);
    });
  });

  describe('createAIConversation', () => {
    it('should create conversation and reload list', async () => {
      vi.mocked(aiConversationService.createConversation).mockResolvedValue(undefined);
      vi.mocked(aiConversationService.getConversations).mockResolvedValue([]);

      const store = createTestStore();
      await store.getState().createAIConversation();

      expect(aiConversationService.createConversation).toHaveBeenCalled();
      expect(aiConversationService.getConversations).toHaveBeenCalled();
    });
  });

  describe('deleteAIConversation', () => {
    it('should delete conversation and reload list', async () => {
      vi.mocked(aiConversationService.deleteConversation).mockResolvedValue(undefined);
      vi.mocked(aiConversationService.getConversations).mockResolvedValue([]);

      const store = createTestStore();
      await store.getState().deleteAIConversation('c1');

      expect(aiConversationService.deleteConversation).toHaveBeenCalledWith('c1');
      expect(aiConversationService.getConversations).toHaveBeenCalled();
    });

    it('should clear selection if deleted conversation was selected', async () => {
      vi.mocked(aiConversationService.deleteConversation).mockResolvedValue(undefined);
      vi.mocked(aiConversationService.getConversations).mockResolvedValue([]);

      const store = createTestStore({ selectedToolItemId: 'c1', showEditor: true });
      await store.getState().deleteAIConversation('c1');

      expect(store.getState().selectedToolItemId).toBeNull();
      expect(store.getState().showEditor).toBe(false);
    });
  });
});
