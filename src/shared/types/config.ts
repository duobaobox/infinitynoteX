/**
 * 共享配置类型定义
 * Single Source of Truth for Configuration
 */

export interface WindowConfig {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

export interface ThemeConfig {
  colorPrimary: string;
  mode: 'light' | 'dark' | 'auto';
  bgLight: string;
  bgDark: string;
}

export interface AIProviderConfig {
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  httpProxy?: string;
  stream?: boolean;
}

export interface AIConfig {
  activeProviderId: string;
  /** 当前使用的 Provider 配置集合 */
  providerConfigs?: Record<string, AIProviderConfig>;
  /** 旧版本字段，仅读取迁移时使用 */
  providers?: Record<string, AIProviderConfig>;
}

export interface WebDAVProviderConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
  conflictStrategy: 'newest' | 'local' | 'remote';
}

export interface SyncConfig {
  enabled: boolean;
  activeProvider: string;
  providers: {
    webdav?: WebDAVProviderConfig;
    [key: string]: unknown;
  };
}

export interface StorageConfig {
  dataPath: string | null;
}

export type PluginConfig = Record<string, unknown>;
export type FeatureConfig = Record<string, unknown>;

export interface AppConfig {
  schemaVersion: number;
  storage: StorageConfig;
  window: WindowConfig;
  aiChatWindow?: { width: number; height: number; x: number; y: number };
  shortcutKeys?: {
    aiChatWindow: string;
  };
  theme: ThemeConfig;
  ai: AIConfig;
  sync: SyncConfig;
  features: FeatureConfig;
  plugins: PluginConfig;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
