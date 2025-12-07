/**
 * Browser Cards Slice - 管理浏览器卡片数据和选中状态
 * 参考 aiConversationSlice.ts 实现
 */

import type { StateCreator } from 'zustand';
import type { BrowserCard } from '../../services/browserCardService';
import { browserCardService } from '../../services';
import type { UISlice } from './uiSlice';

// 定义依赖的其他 slice 类型
type BrowserCardsSliceDeps = UISlice;

export interface BrowserCardsSlice {
  // ============ 状态 ============
  browserCards: BrowserCard[];
  selectedBrowserCardId: string | null;
  refreshBrowserCardsTrigger: number;

  // ============ Actions ============
  setBrowserCards: (cards: BrowserCard[]) => void;
  selectBrowserCard: (id: string | null) => void;
  loadBrowserCards: () => Promise<void>;
  createBrowserCard: (card: { name: string; url: string; icon?: string }) => Promise<void>;
  deleteBrowserCard: (id: string) => Promise<void>;
  updateBrowserCard: (
    id: string,
    patch: { name?: string; url?: string; icon?: string },
  ) => Promise<void>;
  triggerBrowserCardsRefresh: () => void;
}

export const createBrowserCardsSlice: StateCreator<
  BrowserCardsSlice & BrowserCardsSliceDeps,
  [],
  [],
  BrowserCardsSlice
> = (set, get) => ({
  // 初始状态
  browserCards: [],
  selectedBrowserCardId: null,
  refreshBrowserCardsTrigger: 0,

  // Actions
  setBrowserCards: (cards) => set({ browserCards: cards }),
  selectBrowserCard: (id) =>
    set({
      selectedBrowserCardId: id,
      // 选中卡片时自动显示编辑器
      showEditor: !!id,
    }),

  loadBrowserCards: async () => {
    try {
      const cards = await browserCardService.getCards();
      set({ browserCards: cards });
    } catch (error) {
      console.error('[BrowserCardsSlice] Failed to load browser cards:', error);
    }
  },

  createBrowserCard: async (card) => {
    try {
      await browserCardService.createCard(card);
      await get().loadBrowserCards();
    } catch (error) {
      console.error('[BrowserCardsSlice] Failed to create browser card:', error);
      throw error;
    }
  },

  deleteBrowserCard: async (id) => {
    try {
      await browserCardService.deleteCard(id);
      await get().loadBrowserCards();
      // 如果删除的是当前选中的卡片，清空选中状态
      if (get().selectedBrowserCardId === id) {
        set({ selectedBrowserCardId: null, showEditor: false });
      }
    } catch (error) {
      console.error('[BrowserCardsSlice] Failed to delete browser card:', error);
      throw error;
    }
  },

  updateBrowserCard: async (id, patch) => {
    try {
      await browserCardService.updateCard(id, patch);
      await get().loadBrowserCards();
    } catch (error) {
      console.error('[BrowserCardsSlice] Failed to update browser card:', error);
      throw error;
    }
  },

  triggerBrowserCardsRefresh: () =>
    set((state) => ({
      refreshBrowserCardsTrigger: state.refreshBrowserCardsTrigger + 1,
    })),
});
