/**
 * useAIConfig Hook - AI 配置管理
 *
 * 封装 AI 配置的读取、Provider 切换等逻辑
 */

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import type { AIConfig } from '../../../services/aiConfig';
import { detectProviderIdFromConfig, ensureAIConfigDefaults } from '../../../services/aiProviders';
import {
  readStoredProviderConfigs,
  subscribeAIConfigChanged,
  initializeAIConfigCache,
} from '../../../services/aiConfigStore';
import type { ProviderOption, UseAIConfigReturn } from '../types';

/**
 * 检查 AI 配置是否就绪
 */
const isAIConfigReady = (config?: AIConfig | null) => {
  if (!config) {
    return false;
  }
  return !!config.baseURL?.trim() && !!config.model?.trim() && !!config.apiKey?.trim();
};

/**
 * AI 配置管理 Hook
 */
export const useAIConfig = (): UseAIConfigReturn => {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 刷新 Provider 选项
  const refreshProviderOptions = useCallback((activeConfig?: AIConfig | null) => {
    const stored = readStoredProviderConfigs();
    const normalized: Record<string, AIConfig> = {};

    Object.entries(stored).forEach(([providerId, cfg]) => {
      normalized[providerId] = ensureAIConfigDefaults({ ...cfg, providerId });
    });

    if (activeConfig) {
      const activeId = detectProviderIdFromConfig(activeConfig);
      normalized[activeId] = ensureAIConfigDefaults({ ...activeConfig, providerId: activeId });
    }

    const readyOptions = Object.entries(normalized)
      .map(([providerId, cfg]) => ({ providerId, config: cfg }))
      .filter(({ config }) => isAIConfigReady(config));

    setProviderOptions(readyOptions);
  }, []);

  // 初始化检查配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        // 确保 AI 配置缓存已初始化
        await initializeAIConfigCache();

        const aiConfig = await window.ai.getConfig();
        const normalizedConfig = aiConfig ? ensureAIConfigDefaults(aiConfig) : null;
        setConfig(normalizedConfig);
        setIsConfigured(isAIConfigReady(normalizedConfig));
        refreshProviderOptions(normalizedConfig);
      } catch (err) {
        console.error('Failed to check AI config:', err);
        setIsConfigured(false);
        setConfig(null);
        refreshProviderOptions(null);
      } finally {
        setIsInitializing(false);
      }
    };
    checkConfig();
  }, [refreshProviderOptions]);

  // 订阅配置变更
  useEffect(() => {
    const unsubscribe = subscribeAIConfigChanged((nextConfig) => {
      const normalized = ensureAIConfigDefaults(nextConfig);
      setConfig(normalized);
      setIsConfigured(isAIConfigReady(normalized));
      refreshProviderOptions(normalized);
    });
    return unsubscribe;
  }, [refreshProviderOptions]);

  // 切换 Provider
  const switchProvider = useCallback(
    async (providerId: string) => {
      if (!providerId) return;

      const target = providerOptions.find((option) => option.providerId === providerId);
      if (!target) return;

      const currentProviderId = detectProviderIdFromConfig(config ?? undefined);
      if (providerId === currentProviderId) return;

      try {
        setIsSwitching(true);
        const normalized = ensureAIConfigDefaults(target.config);
        await window.ai.setConfig(normalized);
        setConfig(normalized);
        setIsConfigured(true);
        message.success(`已切换到 ${normalized.provider} · ${normalized.model}`);
        refreshProviderOptions(normalized);
      } catch (err) {
        console.error('Failed to switch AI config:', err);
        const errorMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : '未知错误';
        message.error(`切换失败：${errorMsg}`);
      } finally {
        setIsSwitching(false);
      }
    },
    [config, providerOptions, refreshProviderOptions],
  );

  const currentProviderId = detectProviderIdFromConfig(config ?? undefined);

  return {
    isConfigured,
    isInitializing,
    config,
    providerOptions,
    currentProviderId,
    switchProvider,
    isSwitching,
  };
};
