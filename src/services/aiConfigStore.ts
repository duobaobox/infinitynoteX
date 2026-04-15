/**
 * AI Config Store - AI 配置存储与事件系统
 *
 * 重构说明：
 * - 配置统一由主进程写入 app-config.json
 * - 此文件只负责缓存脱敏后的 Provider 配置和广播变更事件
 */

import type { AIConfig } from './aiConfig';

export const AI_CONFIG_CHANGED_EVENT = 'infinitynotex:ai-config-changed';

// 内存缓存，避免频繁 IPC 调用
let providerConfigsCache: Record<string, AIConfig> | null = null;

/**
 * 初始化 AI 配置缓存（应用启动时调用）
 */
export const initializeAIConfigCache = async (): Promise<void> => {
  try {
    const appConfig = await window.app.getConfig();
    providerConfigsCache = appConfig.ai?.providerConfigs ?? {};
  } catch (error) {
    console.warn('[AI] Failed to initialize config cache:', error);
    providerConfigsCache = {};
  }
};

/**
 * 同步读取已存储的 Provider 配置
 * 注意：首次调用前需要先调用 initializeAIConfigCache()
 */
export const readStoredProviderConfigs = (): Record<string, AIConfig> => {
  if (providerConfigsCache === null) {
    console.warn('[AI] Config cache not initialized, returning empty object');
    return {};
  }
  return { ...providerConfigsCache };
};

/**
 * 异步读取 Provider 配置（用于需要最新数据的场景）
 */
export const readStoredProviderConfigsAsync = async (): Promise<Record<string, AIConfig>> => {
  try {
    const appConfig = await window.app.getConfig();
    providerConfigsCache = appConfig.ai?.providerConfigs ?? {};
    return { ...providerConfigsCache };
  } catch (error) {
    console.warn('[AI] Failed to read provider configs:', error);
    return providerConfigsCache ?? {};
  }
};

export const updateProviderConfigsCache = (configs: Record<string, AIConfig>): void => {
  providerConfigsCache = { ...configs };
};

/**
 * 发送 AI 配置变更事件
 */
export const emitAIConfigChanged = (config: AIConfig): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent<AIConfig>(AI_CONFIG_CHANGED_EVENT, { detail: config }));
};

/**
 * 订阅 AI 配置变更事件
 */
export const subscribeAIConfigChanged = (handler: (config: AIConfig) => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AIConfig>).detail;
    if (detail) {
      handler(detail);
    }
  };

  window.addEventListener(AI_CONFIG_CHANGED_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener(AI_CONFIG_CHANGED_EVENT, listener as EventListener);
  };
};
