/**
 * AI Conversation Slice - 管理 AI 对话数据和选中状态
 */

import type { StateCreator } from 'zustand';
import type { AIConversationPreview } from '../../constants/tools';
import type { UISlice } from './uiSlice';

// 定义依赖的其他 slice 类型（setSelectedToolItem 需要访问 UISlice.showEditor）
type AIConversationSliceDeps = UISlice;

export interface AIConversationSlice {
  // ============ 状态 ============
  aiConversations: AIConversationPreview[];
  selectedToolId: string | null;
  selectedToolItemId: string | null;
  refreshAIConversationsTrigger: number;

  // ============ Actions ============
  setAIConversations: (conversations: AIConversationPreview[]) => void;
  setSelectedTool: (toolId: string | null) => void;
  setSelectedToolItem: (itemId: string | null) => void;
  loadAIConversations: () => Promise<void>;
  createAIConversation: () => Promise<void>;
  deleteAIConversation: (id: string) => Promise<void>;
  triggerAIConversationsRefresh: () => void;
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
  selectedToolItemId: null,
  refreshAIConversationsTrigger: 0,

  // Actions
  setAIConversations: (conversations) => set({ aiConversations: conversations }),
  setSelectedTool: (toolId) => set({ selectedToolId: toolId }),
  setSelectedToolItem: (itemId) =>
    set({
      selectedToolItemId: itemId,
      // 选中对话时自动显示编辑器，与 NoteSlice 保持一致
      showEditor: !!itemId,
    }),

  loadAIConversations: async () => {
    try {
      const conversations = await window.storage.getAIConversations();
      set({ aiConversations: conversations });
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
      await window.storage.deleteAIConversation(id);
      await get().loadAIConversations();
      // 如果删除的是当前选中的对话，清空选中状态并关闭编辑器
      if (get().selectedToolItemId === id) {
        set({ selectedToolItemId: null, showEditor: false });
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
});
