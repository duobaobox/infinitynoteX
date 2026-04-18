/**
 * AI 配置读写（主进程）
 * 统一基于 app-config.json，渲染进程只能拿到脱敏后的配置。
 */

import type { AIConfig as RendererAIConfig } from '../../src/services/aiConfig';
import { API_KEY_PLACEHOLDER } from '../../src/services/aiConfig';
import type { AppConfig, AIProviderConfig } from '../../src/shared/types/config';
import { readAppConfig, writeAppConfig } from '../config';

const DEFAULT_PROVIDER_ID = 'deepseek';

function normalizeProviderConfigs(config: AppConfig): Record<string, AIProviderConfig> {
  const providerConfigs = config.ai.providerConfigs;
  if (providerConfigs && Object.keys(providerConfigs).length > 0) {
    return { ...providerConfigs };
  }

  const legacyProviders = config.ai.providers;
  if (legacyProviders && Object.keys(legacyProviders).length > 0) {
    return { ...legacyProviders };
  }

  return {};
}

function readActiveProviderConfig(): {
  activeProviderId: string;
  providerConfigs: Record<string, AIProviderConfig>;
  activeConfig?: AIProviderConfig;
} {
  const config = readAppConfig();
  const providerConfigs = normalizeProviderConfigs(config);
  const activeProviderId = resolveActiveProviderId(config, providerConfigs);

  return {
    activeProviderId,
    providerConfigs,
    activeConfig: providerConfigs[activeProviderId],
  };
}

function resolveActiveProviderId(
  config: AppConfig,
  providerConfigs: Record<string, AIProviderConfig>,
): string {
  if (config.ai.activeProviderId && providerConfigs[config.ai.activeProviderId]) {
    return config.ai.activeProviderId;
  }

  const firstProviderId = Object.keys(providerConfigs)[0];
  return firstProviderId || DEFAULT_PROVIDER_ID;
}

function redactProviderConfig(
  providerId: string,
  config?: AIProviderConfig,
): RendererAIConfig | null {
  if (!config) {
    return null;
  }

  return {
    providerId,
    provider: config.provider,
    baseURL: config.baseURL,
    apiKey: config.apiKey ? API_KEY_PLACEHOLDER : '',
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    timeoutMs: config.timeoutMs,
    systemPrompt: config.systemPrompt,
    httpProxy: config.httpProxy,
    stream: config.stream ?? true,
  };
}

function toRuntimeProviderConfig(
  providerId: string,
  config?: AIProviderConfig,
): RendererAIConfig | null {
  if (!config) {
    return null;
  }

  return {
    providerId,
    provider: config.provider,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    timeoutMs: config.timeoutMs,
    systemPrompt: config.systemPrompt,
    httpProxy: config.httpProxy,
    stream: config.stream ?? true,
  };
}

function mergeProviderConfig(
  nextConfig: RendererAIConfig,
  existing?: AIProviderConfig,
): AIProviderConfig {
  const nextApiKey = nextConfig.apiKey?.trim();
  const mergedApiKey =
    nextApiKey === undefined || nextApiKey === API_KEY_PLACEHOLDER
      ? (existing?.apiKey ?? '')
      : nextApiKey;

  return {
    provider: nextConfig.provider?.trim() || existing?.provider || nextConfig.providerId || 'AI',
    baseURL: nextConfig.baseURL?.trim() ?? existing?.baseURL ?? '',
    apiKey: mergedApiKey,
    model: nextConfig.model?.trim() ?? existing?.model ?? '',
    temperature:
      typeof nextConfig.temperature === 'number' ? nextConfig.temperature : existing?.temperature,
    max_tokens:
      typeof nextConfig.max_tokens === 'number' ? nextConfig.max_tokens : existing?.max_tokens,
    timeoutMs:
      typeof nextConfig.timeoutMs === 'number' ? nextConfig.timeoutMs : existing?.timeoutMs,
    systemPrompt: nextConfig.systemPrompt ?? existing?.systemPrompt,
    httpProxy: nextConfig.httpProxy ?? existing?.httpProxy,
    stream: nextConfig.stream ?? existing?.stream ?? true,
  };
}

function sanitizeAISection(config: AppConfig): AppConfig['ai'] {
  const providerConfigs = normalizeProviderConfigs(config);
  const activeProviderId = resolveActiveProviderId(config, providerConfigs);
  const sanitizedProviderConfigs = Object.fromEntries(
    Object.entries(providerConfigs)
      .map(([providerId, providerConfig]) => [
        providerId,
        redactProviderConfig(providerId, providerConfig),
      ])
      .filter((entry): entry is [string, NonNullable<ReturnType<typeof redactProviderConfig>>] =>
        Boolean(entry[1]),
      ),
  );

  return {
    activeProviderId,
    providerConfigs: sanitizedProviderConfigs as AppConfig['ai']['providerConfigs'],
  };
}

export function sanitizeAppConfigForRenderer(config: AppConfig): AppConfig {
  return {
    ...config,
    ai: sanitizeAISection(config),
  };
}

export async function readAIConfig(): Promise<RendererAIConfig | null> {
  const { activeProviderId, activeConfig } = readActiveProviderConfig();
  return redactProviderConfig(activeProviderId, activeConfig);
}

export async function readActiveAIProviderConfig(): Promise<RendererAIConfig | null> {
  const { activeProviderId, activeConfig } = readActiveProviderConfig();
  return toRuntimeProviderConfig(activeProviderId, activeConfig);
}

export async function writeAIConfig(config: RendererAIConfig): Promise<void> {
  const appConfig = readAppConfig();
  const providerConfigs = normalizeProviderConfigs(appConfig);
  const providerId =
    config.providerId?.trim() || appConfig.ai.activeProviderId || DEFAULT_PROVIDER_ID;
  const mergedConfig = mergeProviderConfig(config, providerConfigs[providerId]);

  writeAppConfig({
    ai: {
      activeProviderId: providerId,
      providerConfigs: {
        [providerId]: mergedConfig,
      },
    },
  });
}
