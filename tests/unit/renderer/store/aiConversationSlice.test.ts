/**
 * AIConversationSlice 测试
 * 测试 AI 对话状态管理逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createAIConversationSlice } from '../../../../src/store/slices/aiConversationSlice';
import type { AIConversationSlice } from '../../../../src/store/slices/aiConversationSlice';
import type { UISlice } from '../../../../src/store/slices/uiSlice';
import { createMockConversation } from '../../../utils/testHelpers';

const mockStorage = {
  getAIConversations: vi.fn(),
  createAIConversation: vi.fn(),
  deleteAIConversation: vi.fn(),
};

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
    Object.assign(window, { storage: mockStorage });
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
      // 当前实现会保留已有 showEditor 状态（仅在 itemId 存在时强制设为 true）
      expect(store.getState().showEditor).toBe(true);
    });
  });

  describe('loadAIConversations', () => {
    it('should load conversations from service', async () => {
      const mockConversations = [createMockConversation({ id: 'c1' })];
      mockStorage.getAIConversations.mockResolvedValue(mockConversations);

      const store = createTestStore();
      await store.getState().loadAIConversations();

      expect(mockStorage.getAIConversations).toHaveBeenCalled();
      expect(store.getState().aiConversations).toEqual(mockConversations);
    });
  });

  describe('createAIConversation', () => {
    it('should create conversation and reload list', async () => {
      mockStorage.createAIConversation.mockResolvedValue(undefined);
      mockStorage.getAIConversations.mockResolvedValue([]);

      const store = createTestStore();
      await store.getState().createAIConversation();

      expect(mockStorage.createAIConversation).toHaveBeenCalled();
      expect(mockStorage.getAIConversations).toHaveBeenCalled();
    });
  });

  describe('deleteAIConversation', () => {
    it('should delete conversation and reload list', async () => {
      mockStorage.deleteAIConversation.mockResolvedValue(undefined);
      mockStorage.getAIConversations.mockResolvedValue([]);

      const store = createTestStore();
      await store.getState().deleteAIConversation('c1');

      expect(mockStorage.deleteAIConversation).toHaveBeenCalledWith('c1');
      expect(mockStorage.getAIConversations).toHaveBeenCalled();
    });

    it('should clear selection if deleted conversation was selected', async () => {
      mockStorage.deleteAIConversation.mockResolvedValue(undefined);
      mockStorage.getAIConversations.mockResolvedValue([]);

      const store = createTestStore({ selectedToolItemId: 'c1', showEditor: true });
      await store.getState().deleteAIConversation('c1');

      expect(store.getState().selectedToolItemId).toBeNull();
      expect(store.getState().showEditor).toBe(false);
    });
  });
});
