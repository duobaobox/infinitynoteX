/**
 * Sync Slice - 数据同步状态管理
 */

import type { StateCreator } from 'zustand';

// ============ 类型定义 ============
interface SyncStatus {
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

const getErrMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';

// ============ Slice 类型定义 ============
export interface SyncSlice {
  // 状态
  selectedSyncProvider: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  syncConfigs: Record<string, any>;
  syncStatus: SyncStatus;

  // Actions
  setSelectedSyncProvider: (id: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSyncConfig: (providerId: string, config: any) => void;
  setSyncStatus: (status: Partial<SyncStatus>) => void;
  testSyncConnection: (
    providerId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any,
  ) => Promise<{ ok: boolean; message: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  triggerSync: (providerId: string, config: any) => Promise<any>;
  loadSyncConfigs: () => Promise<void>;
}

// ============ Slice 创建函数 ============
export const createSyncSlice: StateCreator<SyncSlice, [], [], SyncSlice> = (set, get) => ({
  // 初始状态
  selectedSyncProvider: null,
  syncConfigs: {},
  syncStatus: {
    syncing: false,
    lastSync: null,
    error: null,
  },

  // Actions
  setSelectedSyncProvider: (id) => set({ selectedSyncProvider: id }),

  setSyncConfig: (providerId, config) => {
    const { syncConfigs } = get();
    set({
      syncConfigs: {
        ...syncConfigs,
        [providerId]: config,
      },
    });

    // 持久化到主进程（主进程将保存到 app.getPath('userData')/sync-config.json）
    // 采用无阻塞调用，失败时在控制台记录错误
    try {
      // window.sync.setConfig 返回 Promise
      window.sync.setConfig(providerId, config).catch((e) => {
        console.error('Failed to persist sync config to main process:', e);
      });
    } catch (e) {
      console.error('Failed to call window.sync.setConfig:', e);
    }
  },

  setSyncStatus: (status) => {
    set({
      syncStatus: {
        ...get().syncStatus,
        ...status,
      },
    });
  },

  testSyncConnection: async (providerId, config) => {
    try {
      const result = await window.sync.testConnection(providerId, config);
      return result;
    } catch (error) {
      return { ok: false, message: getErrMsg(error) };
    }
  },

  triggerSync: async (providerId, config) => {
    const { setSyncStatus } = get();
    try {
      setSyncStatus({ syncing: true, error: null });
      const result = await window.sync.execute(providerId, config);

      const success = Boolean(result?.success);
      const endTime = typeof result?.endTime === 'number' ? result.endTime : Date.now();
      const message = typeof result?.message === 'string' ? result.message : '';

      setSyncStatus({
        syncing: false,
        lastSync: endTime,
        error: success ? null : message || '同步未成功，请查看详情',
      });

      return result;
    } catch (error) {
      setSyncStatus({
        syncing: false,
        error: getErrMsg(error),
      });
      throw error;
    }
  },

  loadSyncConfigs: async () => {
    try {
      // 目前我们只支持 webdav，后续可以遍历所有 provider
      const webdavConfig = await window.sync.getConfig('webdav');
      if (webdavConfig) {
        set((state) => ({
          syncConfigs: {
            ...state.syncConfigs,
            webdav: webdavConfig,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to load sync configs:', error);
    }
  },
});
