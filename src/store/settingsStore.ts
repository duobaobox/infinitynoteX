/**
 * Settings Store - 使用 Zustand 管理设置相关状态
 * 包含：外观设置、AI 配置、数据管理、应用信息
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StorageStats } from '../services/types';
import type { AIConfig } from '../services/aiConfig';
import {
  DEFAULT_PROVIDER_ID,
  CUSTOM_PROVIDER_ID,
  createDefaultAIConfig,
  ensureAIConfigDefaults,
  findProviderPresetById,
} from '../services/aiProviders';
import {
  emitAIConfigChanged,
  persistProviderConfigs,
  readStoredProviderConfigs,
} from '../services/aiConfigStore';
import {
  getThemeColor,
  setThemeColor,
  getThemeMode,
  setThemeMode,
  getThemeBgLight,
  setThemeBgLight,
  getThemeBgDark,
  setThemeBgDark,
  ThemeMode,
} from '../theme/theme';

// ============ 类型定义 ============

export type ProviderStatus = 'ready' | 'missingKey' | 'incomplete' | 'unconfigured';

export const PROVIDER_STATUS_META: Record<ProviderStatus, { label: string; color: string }> = {
  ready: { label: '就绪', color: '#52c41a' },
  missingKey: { label: '待填密钥', color: '#faad14' },
  incomplete: { label: '待完善', color: '#fa8c16' },
  unconfigured: { label: '未绑定', color: '#bfbfbf' },
};

export const getProviderStatus = (config?: AIConfig | null): ProviderStatus => {
  if (!config) return 'unconfigured';
  if (!config.baseURL?.trim() || !config.model?.trim()) return 'incomplete';
  if (!config.apiKey?.trim()) return 'missingKey';
  return 'ready';
};

export const isConfigReady = (config?: AIConfig | null) => getProviderStatus(config) === 'ready';

// ============ Store State ============

interface SettingsState {
  // ============ 外观设置 ============
  primaryColor: string;
  themeMode: ThemeMode;
  bgLight: string;
  bgDark: string;

  // ============ AI 配置 ============
  aiConfig: AIConfig;
  providerConfigs: Record<string, AIConfig>;
  selectedProviderId: string;
  activeProviderId: string;
  aiLoading: boolean;
  aiTestLoading: boolean;
  aiTestResult: { ok: boolean; message: string } | null;

  // ============ 数据管理 ============
  currentPath: string;
  stats: StorageStats | null;
  migrating: boolean;

  // ============ 数据同步 ============
  selectedSyncProvider: string | null;
  syncConfigs: Record<string, any>; // 各provider的配置
  syncStatus: {
    syncing: boolean;
    lastSync: number | null;
    error: string | null;
  };

  // ============ 应用信息 ============
  appVersion: string;

  // ============ Actions ============

  // 外观设置
  setPrimaryColor: (color: string) => void;
  applyPrimaryColor: (color: string) => void;
  setThemeModeState: (mode: ThemeMode) => void;
  applyThemeMode: (mode: ThemeMode) => void;
  setBgLight: (bg: string) => void;
  setBgDark: (bg: string) => void;
  applyBackground: (bg: string, mode: 'light' | 'dark') => void;
  initAppearance: () => void;

  // AI 配置
  setAIConfig: (config: AIConfig) => void;
  setProviderConfigs: (configs: Record<string, AIConfig>) => void;
  setSelectedProviderId: (id: string) => void;
  setActiveProviderId: (id: string) => void;
  setAILoading: (loading: boolean) => void;
  setAITestLoading: (loading: boolean) => void;
  setAITestResult: (result: { ok: boolean; message: string } | null) => void;
  syncCurrentConfig: (patch: Partial<AIConfig> | ((prev: AIConfig) => AIConfig)) => void;
  handleProviderSelect: (providerId: string) => void;
  normalizeCurrentConfig: (config: AIConfig, providerId: string) => AIConfig;
  loadAIConfig: () => Promise<void>;
  saveAIConfig: () => Promise<void>;
  testAIConnection: () => Promise<void>;
  applyProviderConfig: (
    config: AIConfig,
    options?: { skipTest?: boolean },
  ) => Promise<{ ok: boolean; message: string }>;

  // 数据管理
  setCurrentPath: (path: string) => void;
  setStats: (stats: StorageStats | null) => void;
  setMigrating: (migrating: boolean) => void;
  loadStorageInfo: () => Promise<void>;

  // 数据同步
  setSelectedSyncProvider: (id: string | null) => void;
  setSyncConfig: (providerId: string, config: any) => void;
  setSyncStatus: (status: Partial<SettingsState['syncStatus']>) => void;
  testSyncConnection: (
    providerId: string,
    config: any,
  ) => Promise<{ ok: boolean; message: string }>;
  triggerSync: (providerId: string, config: any) => Promise<void>;
  loadSyncConfigs: () => Promise<void>;

  // 应用信息
  setAppVersion: (version: string) => void;
  loadAppInfo: () => Promise<void>;
}

// 内部引用，用于存储上一次激活的配置
let activeConfigRef: AIConfig | null = null;

const getErrMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set, get) => ({
      // ============ 初始状态 ============

      // 外观设置
      primaryColor: getThemeColor(),
      themeMode: getThemeMode(),
      bgLight: getThemeBgLight(),
      bgDark: getThemeBgDark(),

      // AI 配置
      aiConfig: createDefaultAIConfig(),
      providerConfigs: {},
      selectedProviderId: DEFAULT_PROVIDER_ID,
      activeProviderId: DEFAULT_PROVIDER_ID,
      aiLoading: false,
      aiTestLoading: false,
      aiTestResult: null,

      // 数据管理
      currentPath: '',
      stats: null,
      migrating: false,

      // 数据同步
      selectedSyncProvider: null,
      syncConfigs: {},
      syncStatus: {
        syncing: false,
        lastSync: null,
        error: null,
      },

      // 应用信息
      appVersion: '0.0.0',

      // ============ Actions 实现 ============

      // 外观设置
      setPrimaryColor: (color) => set({ primaryColor: color }),

      applyPrimaryColor: (color) => {
        set({ primaryColor: color });
        setThemeColor(color);
      },

      setThemeModeState: (mode) => set({ themeMode: mode }),

      applyThemeMode: (mode) => {
        set({ themeMode: mode });
        setThemeMode(mode);
      },

      setBgLight: (bg) => set({ bgLight: bg }),

      setBgDark: (bg) => set({ bgDark: bg }),

      applyBackground: (bg, mode) => {
        if (mode === 'dark') {
          set({ bgDark: bg });
          setThemeBgDark(bg);
        } else {
          set({ bgLight: bg });
          setThemeBgLight(bg);
        }
      },

      initAppearance: () => {
        set({
          primaryColor: getThemeColor(),
          themeMode: getThemeMode(),
          bgLight: getThemeBgLight(),
          bgDark: getThemeBgDark(),
        });
      },

      // AI 配置
      setAIConfig: (config) => set({ aiConfig: config }),

      setProviderConfigs: (configs) => set({ providerConfigs: configs }),

      setSelectedProviderId: (id) => set({ selectedProviderId: id }),

      setActiveProviderId: (id) => set({ activeProviderId: id }),

      setAILoading: (loading) => set({ aiLoading: loading }),

      setAITestLoading: (loading) => set({ aiTestLoading: loading }),

      setAITestResult: (result) => set({ aiTestResult: result }),

      syncCurrentConfig: (patch) => {
        const { aiConfig, selectedProviderId, providerConfigs } = get();
        const next =
          typeof patch === 'function'
            ? (patch as (value: AIConfig) => AIConfig)(aiConfig)
            : { ...aiConfig, ...patch };
        const normalized = { ...next, providerId: selectedProviderId };
        set({
          aiConfig: normalized,
          providerConfigs: {
            ...providerConfigs,
            [selectedProviderId]: normalized,
          },
        });
      },

      handleProviderSelect: (providerId) => {
        const { providerConfigs } = get();
        set({ selectedProviderId: providerId, aiTestResult: null });
        const existing =
          providerConfigs[providerId] ?? ensureAIConfigDefaults(createDefaultAIConfig(providerId));
        const normalized = { ...existing, providerId };
        set({
          aiConfig: normalized,
          providerConfigs: {
            ...providerConfigs,
            [providerId]: normalized,
          },
        });
      },

      normalizeCurrentConfig: (config, providerId) => ({
        ...config,
        providerId,
        provider:
          config.provider?.trim() || findProviderPresetById(providerId)?.name || '自定义服务',
        baseURL: config.baseURL?.trim() ?? '',
        apiKey: config.apiKey?.trim() ?? '',
        model: config.model?.trim() ?? '',
        temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
        max_tokens: config.max_tokens ?? 3500,
        stream: true,
        timeoutMs: config.timeoutMs ?? 60000,
      }),

      loadAIConfig: async () => {
        try {
          set({ aiLoading: true });
          const stored = readStoredProviderConfigs();
          const normalizedStored: Record<string, AIConfig> = {};
          Object.entries(stored).forEach(([id, cfg]) => {
            normalizedStored[id] = ensureAIConfigDefaults({ ...cfg, providerId: id });
          });

          const active = ensureAIConfigDefaults(await window.ai.getConfig());
          const resolvedProviderId = active.providerId ?? DEFAULT_PROVIDER_ID;
          normalizedStored[resolvedProviderId] = active;

          set({
            providerConfigs: normalizedStored,
            selectedProviderId: resolvedProviderId,
            activeProviderId: resolvedProviderId,
            aiConfig: normalizedStored[resolvedProviderId],
            aiTestResult: null,
          });
          activeConfigRef = active;
        } catch (error) {
          console.error('Failed to load AI config:', error);
        } finally {
          set({ aiLoading: false });
        }
      },

      saveAIConfig: async () => {
        const { aiConfig, selectedProviderId, syncCurrentConfig, applyProviderConfig } = get();
        const normalized = get().normalizeCurrentConfig(aiConfig, selectedProviderId);
        if (!isConfigReady(normalized)) {
          return;
        }
        try {
          set({ aiLoading: true });
          syncCurrentConfig(() => normalized);
          await applyProviderConfig(normalized);
        } finally {
          set({ aiLoading: false });
        }
      },

      testAIConnection: async () => {
        try {
          set({ aiTestLoading: true });
          const result = await window.ai.testConnection();
          set({ aiTestResult: result });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          set({ aiTestResult: { ok: false, message: `连接测试失败：${msg}` } });
        } finally {
          set({ aiTestLoading: false });
        }
      },

      applyProviderConfig: async (config, options) => {
        const previous = activeConfigRef;
        try {
          await window.ai.setConfig(config);
          activeConfigRef = config;
          set({ activeProviderId: config.providerId ?? CUSTOM_PROVIDER_ID });
          emitAIConfigChanged(config);

          if (options?.skipTest) {
            return { ok: true, message: '配置已切换' };
          }

          const result = await window.ai.testConnection();
          set({ aiTestResult: result });
          if (!result.ok && previous) {
            await window.ai.setConfig(previous);
            activeConfigRef = previous;
            set({ activeProviderId: previous.providerId ?? CUSTOM_PROVIDER_ID });
            emitAIConfigChanged(previous);
          }
          return result;
        } catch (error) {
          if (previous) {
            await window.ai.setConfig(previous);
            activeConfigRef = previous;
            set({ activeProviderId: previous.providerId ?? CUSTOM_PROVIDER_ID });
            emitAIConfigChanged(previous);
          }
          return { ok: false, message: getErrMsg(error) };
        }
      },

      // 数据管理
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

      // 数据同步
      setSelectedSyncProvider: (id) => set({ selectedSyncProvider: id }),

      setSyncConfig: (providerId, config) => {
        const { syncConfigs } = get();
        set({
          syncConfigs: {
            ...syncConfigs,
            [providerId]: config,
          },
        });
        // TODO: 持久化到本地
        // localStorage.setItem('syncConfigs', JSON.stringify(get().syncConfigs));
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
          await window.sync.execute(providerId, config);
          setSyncStatus({
            syncing: false,
            lastSync: Date.now(),
            error: null,
          });
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

      // 应用信息
      setAppVersion: (version) => set({ appVersion: version }),

      loadAppInfo: async () => {
        try {
          const version = (await window.appInfo?.getVersion?.()) ?? '0.0.0';
          set({ appVersion: version });
        } catch (error) {
          console.error('Failed to load app info:', error);
          set({ appVersion: '0.0.0' });
        }
      },
    }),
    {
      name: 'SettingsStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// 持久化 providerConfigs 的副作用（使用 Zustand 5 的 subscribeWithSelector）
export const persistProviderConfigsEffect = () => {
  let prevProviderConfigs = useSettingsStore.getState().providerConfigs;
  const unsubscribe = useSettingsStore.subscribe((state) => {
    const { providerConfigs } = state;
    if (providerConfigs !== prevProviderConfigs && Object.keys(providerConfigs).length > 0) {
      prevProviderConfigs = providerConfigs;
      persistProviderConfigs(providerConfigs);
    }
  });
  return unsubscribe;
};
