/**
 * Sync Slice - 数据同步状态管理
 */

import type { StateCreator } from 'zustand';
import type { SyncConfig, SyncResult } from '../../shared/types/sync';

// ============ 类型定义 ============
interface SyncStatus {
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

const getErrMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';

// 记录每个 provider 最近一次配置持久化请求版本，避免旧请求失败回滚新输入
const persistRequestVersion: Record<string, number> = {};

// ============ Slice 类型定义 ============
export interface SyncSlice {
  // 状态
  selectedSyncProvider: string | null;
  syncConfigs: Record<string, SyncConfig>;
  syncStatus: SyncStatus;

  // Actions
  setSelectedSyncProvider: (id: string | null) => void;
  setSyncConfig: (providerId: string, config: SyncConfig) => void;
  setSyncStatus: (status: Partial<SyncStatus>) => void;
  testSyncConnection: (
    providerId: string,
    config: SyncConfig,
  ) => Promise<{ ok: boolean; message: string }>;
  triggerSync: (providerId: string, config: SyncConfig) => Promise<SyncResult>;
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
    const previousConfig = get().syncConfigs[providerId];
    const requestVersion = (persistRequestVersion[providerId] || 0) + 1;
    persistRequestVersion[providerId] = requestVersion;

    // 乐观更新本地状态
    set((state) => ({
      syncConfigs: {
        ...state.syncConfigs,
        [providerId]: config,
      },
    }));

    // 持久化到主进程，失败时回滚本地状态并提示
    window.sync.setConfig(providerId, config).catch((e) => {
      console.error('Failed to persist sync config to main process:', e);

      // 已有更新请求发出，当前失败属于旧请求，忽略其回滚
      if (persistRequestVersion[providerId] !== requestVersion) {
        return;
      }

      // 回滚当前 provider 到提交前的值，避免整表回滚导致新输入丢失
      set((state) => {
        const nextConfigs = { ...state.syncConfigs };
        if (previousConfig !== undefined) {
          nextConfigs[providerId] = previousConfig;
        } else {
          delete nextConfigs[providerId];
        }
        return { syncConfigs: nextConfigs };
      });
    });
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
      const result = (await window.sync.execute(providerId, config)) as SyncResult;

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
