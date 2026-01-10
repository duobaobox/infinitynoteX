/**
 * Storage Slice - 数据管理状态
 */

import type { StateCreator } from 'zustand';
import type { StorageStats } from '../../services/types';

// ============ Slice 类型定义 ============
export interface StorageSlice {
  // 状态
  currentPath: string;
  stats: StorageStats | null;
  migrating: boolean;

  // Actions
  setCurrentPath: (path: string) => void;
  setStats: (stats: StorageStats | null) => void;
  setMigrating: (migrating: boolean) => void;
  loadStorageInfo: () => Promise<void>;
}

// ============ Slice 创建函数 ============
export const createStorageSlice: StateCreator<StorageSlice, [], [], StorageSlice> = (set) => ({
  // 初始状态
  currentPath: '',
  stats: null,
  migrating: false,

  // Actions
  setCurrentPath: (path) => set({ currentPath: path }),

  setStats: (stats) => set({ stats }),

  setMigrating: (migrating) => set({ migrating }),

  loadStorageInfo: async () => {
    try {
      const path = await window.storage.getCurrentPath();
      const storageStats = await window.storage.getStats();
      set({ currentPath: path, stats: storageStats });
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  },
});
