/**
 * AI Conversation Slice - 管理 AI 对话数据和选中状态
 */

import type { StateCreator } from 'zustand';
import type { AIConversationPreview } from '../../constants/tools';
import type { AIWorkbenchConversationItem } from '../../features/ai-workbench/model/workbenchConversationItems';
import {
  getDefaultAIWorkbenchSelectionId,
  resolveAIWorkbenchSelection,
} from '../../features/ai-workbench/model/workbenchConversationItems';
import type { UISlice } from './uiSlice';

// 定义依赖的其他 slice 类型（setSelectedToolItem 需要访问 UISlice.showEditor）
type AIConversationSliceDeps = UISlice;

function reconcileSelectedAIWorkbenchItem(
  currentItem: AIWorkbenchConversationItem | null,
  fallbackItemId: string | null,
  conversations: AIConversationPreview[],
): AIWorkbenchConversationItem | null {
  if (currentItem) {
    return resolveAIWorkbenchSelection(currentItem.id, conversations);
  }

  if (fallbackItemId) {
    return resolveAIWorkbenchSelection(fallbackItemId, conversations);
  }

  return null;
}

export interface AIConversationSlice {
  // ============ 状态 ============
  aiConversations: AIConversationPreview[];
  selectedToolId: string | null;
  /** AI 工坊当前选中的结构化会话项 */
  selectedAIWorkbenchItem: AIWorkbenchConversationItem | null;
  /** 兼容旧调用链保留的字符串 ID */
  selectedToolItemId: string | null;
  refreshAIConversationsTrigger: number;
  /** 单个对话消息刷新触发器 - key 是 conversationId，value 是触发次数 */
  messageRefreshTriggers: Record<string, number>;

  // ============ Actions ============
  setAIConversations: (conversations: AIConversationPreview[]) => void;
  setSelectedTool: (toolId: string | null) => void;
  setSelectedAIWorkbenchItem: (item: AIWorkbenchConversationItem | null) => void;
  setSelectedToolItem: (itemId: string | null) => void;
  loadAIConversations: () => Promise<void>;
  createAIConversation: () => Promise<void>;
  deleteAIConversation: (id: string) => Promise<void>;
  triggerAIConversationsRefresh: () => void;
  /** 触发特定对话的消息刷新 */
  triggerMessageRefresh: (conversationId: string) => void;
}

export const createAIConversationSlice: StateCreator<
  AIConversationSlice & AIConversationSliceDeps,
  [],
  [],
  AIConversationSlice
> = (set, get) => ({
  // 初始状态
  aiConversations: [],
  selectedToolId: null,
  selectedAIWorkbenchItem: null,
  selectedToolItemId: null,
  refreshAIConversationsTrigger: 0,
  messageRefreshTriggers: {},

  // Actions
  setAIConversations: (conversations) =>
    set((state) => {
      const selectedAIWorkbenchItem = reconcileSelectedAIWorkbenchItem(
        state.selectedAIWorkbenchItem,
        state.selectedToolItemId,
        conversations,
      );

      return {
        aiConversations: conversations,
        selectedAIWorkbenchItem,
        selectedToolItemId: selectedAIWorkbenchItem?.id ?? null,
      };
    }),
  setSelectedTool: (toolId) => set({ selectedToolId: toolId }),
  setSelectedAIWorkbenchItem: (item) =>
    set((state) => ({
      selectedAIWorkbenchItem: item,
      selectedToolItemId: item?.id ?? null,
      // 强制设为 true（解决折叠后点击无法展开的问题）
      showEditor: item ? true : state.showEditor,
    })),
  setSelectedToolItem: (itemId) => {
    if (!itemId) {
      get().setSelectedAIWorkbenchItem(null);
      return;
    }

    const selectedAIWorkbenchItem =
      resolveAIWorkbenchSelection(itemId, get().aiConversations) ??
      resolveAIWorkbenchSelection(getDefaultAIWorkbenchSelectionId(), get().aiConversations);

    if (selectedAIWorkbenchItem?.id === itemId) {
      get().setSelectedAIWorkbenchItem(selectedAIWorkbenchItem);
      return;
    }

    // 无法解析时保留兼容字段，等待后续列表刷新后再自动对齐
    set((state) => ({
      selectedToolItemId: itemId,
      selectedAIWorkbenchItem: state.selectedAIWorkbenchItem,
      showEditor: true,
    }));
  },

  loadAIConversations: async () => {
    try {
      const conversations = await window.storage.listAIConversationPreviews();
      get().setAIConversations(conversations);
    } catch (error) {
      console.error('[AIConversationSlice] Failed to load AI conversations:', error);
    }
  },

  createAIConversation: async () => {
    try {
      await window.storage.createAIConversation();
      await get().loadAIConversations();
    } catch (error) {
      console.error('[AIConversationSlice] Failed to create AI conversation:', error);
      throw error;
    }
  },

  deleteAIConversation: async (id) => {
    try {
      const previousSelection = get().selectedAIWorkbenchItem;
      await window.storage.deleteAIConversation(id);
      await get().loadAIConversations();
      if (
        previousSelection &&
        !previousSelection.isSystemEntry &&
        previousSelection.conversationId === id
      ) {
        set({
          selectedAIWorkbenchItem: null,
          selectedToolItemId: null,
          showEditor: false,
        });
      }
    } catch (error) {
      console.error('[AIConversationSlice] Failed to delete AI conversation:', error);
      throw error;
    }
  },

  triggerAIConversationsRefresh: () =>
    set((state) => ({
      refreshAIConversationsTrigger: state.refreshAIConversationsTrigger + 1,
    })),

  triggerMessageRefresh: (conversationId) =>
    set((state) => ({
      messageRefreshTriggers: {
        ...state.messageRefreshTriggers,
        [conversationId]: (state.messageRefreshTriggers[conversationId] ?? 0) + 1,
      },
    })),
});
