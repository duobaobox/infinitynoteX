/**
 * AI Config Slice - AI 配置状态管理
 */

import type { StateCreator } from 'zustand';
import type { AIConfig } from '../../services/aiConfig';
import {
  DEFAULT_PROVIDER_ID,
  CUSTOM_PROVIDER_ID,
  createDefaultAIConfig,
  ensureAIConfigDefaults,
  findProviderPresetById,
} from '../../services/aiProviders';
import {
  emitAIConfigChanged,
  readStoredProviderConfigs,
  initializeAIConfigCache,
  updateProviderConfigsCache,
} from '../../services/aiConfigStore';

// ============ 辅助类型和函数 ============
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

// 内部引用，用于存储上一次激活的配置
let activeConfigRef: AIConfig | null = null;

const getErrMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : '未知错误';

// ============ Slice 类型定义 ============
export interface AIConfigSlice {
  // 状态
  aiConfig: AIConfig;
  providerConfigs: Record<string, AIConfig>;
  selectedProviderId: string;
  activeProviderId: string;
  aiLoading: boolean;
  aiTestLoading: boolean;
  aiTestResult: { ok: boolean; message: string } | null;

  // Actions
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
}

// ============ Slice 创建函数 ============
export const createAIConfigSlice: StateCreator<AIConfigSlice, [], [], AIConfigSlice> = (
  set,
  get,
) => ({
  // 初始状态
  aiConfig: createDefaultAIConfig(),
  providerConfigs: {},
  selectedProviderId: DEFAULT_PROVIDER_ID,
  activeProviderId: DEFAULT_PROVIDER_ID,
  aiLoading: false,
  aiTestLoading: false,
  aiTestResult: null,

  // Actions
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
    provider: config.provider?.trim() || findProviderPresetById(providerId)?.name || '自定义服务',
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

      // 初始化 AI 配置缓存（从 app-config.json 读取）
      await initializeAIConfigCache();

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
      updateProviderConfigsCache(normalizedStored);
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
      updateProviderConfigsCache({
        ...get().providerConfigs,
        [config.providerId ?? CUSTOM_PROVIDER_ID]: config,
      });
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
        updateProviderConfigsCache({
          ...get().providerConfigs,
          [previous.providerId ?? CUSTOM_PROVIDER_ID]: previous,
        });
        emitAIConfigChanged(previous);
      }
      return result;
    } catch (error) {
      if (previous) {
        await window.ai.setConfig(previous);
        activeConfigRef = previous;
        set({ activeProviderId: previous.providerId ?? CUSTOM_PROVIDER_ID });
        updateProviderConfigsCache({
          ...get().providerConfigs,
          [previous.providerId ?? CUSTOM_PROVIDER_ID]: previous,
        });
        emitAIConfigChanged(previous);
      }
      return { ok: false, message: getErrMsg(error) };
    }
  },
});
