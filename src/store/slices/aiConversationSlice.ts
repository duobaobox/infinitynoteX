/**
 * AI Conversation Slice - 管理 AI 对话数据和选中状态
 */

import type { StateCreator } from 'zustand';
import type { AIConversationPreview } from '../../constants/tools';
import { aiConversationService } from '../../services';
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
    // 使用函数式更新，确保即使 ID 相同也能更新 showEditor
    set((state) => ({
      selectedToolItemId: itemId,
      // 强制设为 true（解决折叠后点击无法展开的问题）
      showEditor: itemId ? true : state.showEditor,
    })),

  loadAIConversations: async () => {
    try {
      const conversations = await aiConversationService.getConversations();
      set({ aiConversations: conversations });
    } catch (error) {
      console.error('[AIConversationSlice] Failed to load AI conversations:', error);
    }
  },

  createAIConversation: async () => {
    try {
      await aiConversationService.createConversation();
      await get().loadAIConversations();
    } catch (error) {
      console.error('[AIConversationSlice] Failed to create AI conversation:', error);
      throw error;
    }
  },

  deleteAIConversation: async (id) => {
    try {
      await aiConversationService.deleteConversation(id);
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
