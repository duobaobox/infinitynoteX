/**
 * 统一配置管理模块
 * 负责读写 app-config.json，提供类型安全的配置 API
 */

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// ============ 类型定义 ============

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
}

export interface AIConfig {
  activeProviderId: string;
  providers: Record<string, AIProviderConfig>;
  /** 前端使用的完整 provider 配置缓存 */
  providerConfigs?: Record<string, any>;
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
    [key: string]: any;
  };
}

export interface StorageConfig {
  dataPath: string | null;
}

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
  features: Record<string, unknown>;
  plugins: Record<string, unknown>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// ============ 常量 ============

const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_CONFIG: AppConfig = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  storage: {
    dataPath: null,
  },
  window: {
    width: 1200,
    height: 800,
    isMaximized: false,
  },
  theme: {
    colorPrimary: '#1677ff',
    mode: 'auto',
    bgLight: 'linear-gradient(135deg, #e6f2ff 0%, #f0e6ff 100%)',
    bgDark: 'linear-gradient(165deg, #111827 0%, #0b1220 100%)',
  },
  ai: {
    activeProviderId: 'deepseek',
    providers: {
      deepseek: {
        provider: 'deepseek',
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: '',
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 4096,
      },
      openai: {
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
      },
      ollama: {
        provider: 'ollama',
        baseURL: 'http://localhost:11434',
        apiKey: '',
        model: 'llama3',
      },
    },
  },
  sync: {
    enabled: false,
    activeProvider: 'webdav',
    providers: {
      webdav: {
        url: '',
        username: '',
        password: '',
        remotePath: '/InfinityNoteX',
        conflictStrategy: 'newest',
      },
    },
  },
  features: {},
  plugins: {},
};

// ============ 工具函数 ============

/**
 * 深度合并对象
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = target[key as keyof T];

      if (sourceValue === undefined) {
        // 如果 source 值为 undefined，删除该键（用于插件卸载等场景）
        delete (result as any)[key];
      } else if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // 递归合并对象
        (result as any)[key] = deepMerge(targetValue as object, sourceValue as object);
      } else {
        // 直接覆盖
        (result as any)[key] = sourceValue;
      }
    }
  }

  return result;
}

// ============ 核心 API ============

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'app-config.json');
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): AppConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/**
 * 读取配置（同步）
 */
export function readAppConfig(): AppConfig {
  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw) as Partial<AppConfig>;
      // 合并默认配置以确保所有字段存在
      const merged = deepMerge(getDefaultConfig(), config);
      // 执行迁移
      return migrateConfig(merged);
    }
  } catch (error) {
    console.error('[Config] Failed to read config:', error);
  }

  // 返回默认配置
  return getDefaultConfig();
}

/**
 * 写入配置（深度合并）
 */
export function writeAppConfig(partial: DeepPartial<AppConfig>): void {
  const configPath = getConfigPath();

  try {
    const current = readAppConfig();
    const merged = deepMerge(current, partial);
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
    console.log('[Config] Config saved successfully');
  } catch (error) {
    console.error('[Config] Failed to write config:', error);
    throw new Error('Failed to save config');
  }
}

/**
 * 完整覆写配置（不合并）
 */
export function overwriteAppConfig(config: AppConfig): void {
  const configPath = getConfigPath();

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[Config] Config overwritten successfully');
  } catch (error) {
    console.error('[Config] Failed to overwrite config:', error);
    throw new Error('Failed to overwrite config');
  }
}

/**
 * 配置版本迁移
 */
export function migrateConfig(config: AppConfig): AppConfig {
  let currentVersion = config.schemaVersion || 1;

  // 迁移逻辑
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    currentVersion++;
    console.log(`[Config] Migrating from version ${currentVersion - 1} to ${currentVersion}`);

    switch (currentVersion) {
      // 添加迁移逻辑
      // case 2:
      //   config = migrateV1ToV2(config);
      //   break;
      default:
        break;
    }
  }

  config.schemaVersion = CURRENT_SCHEMA_VERSION;
  return config;
}

// ============ 旧配置文件迁移 ============

/**
 * 从旧配置文件迁移数据
 * 在首次启动时调用，将旧的独立配置文件合并到 app-config.json
 */
export async function migrateFromLegacyConfigs(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const configPath = getConfigPath();

  // 如果 app-config.json 已存在，跳过迁移
  if (fs.existsSync(configPath)) {
    console.log('[Config] app-config.json exists, skipping legacy migration');
    return;
  }

  console.log('[Config] Starting legacy config migration...');

  const config = getDefaultConfig();

  // 迁移 ai-config.json
  const aiConfigPath = path.join(userDataPath, 'ai-config.json');
  if (fs.existsSync(aiConfigPath)) {
    try {
      const aiConfig = JSON.parse(fs.readFileSync(aiConfigPath, 'utf-8'));
      // 旧格式是单个 provider，需要转换为新格式
      if (aiConfig.provider && aiConfig.baseURL) {
        const providerId = aiConfig.provider;
        config.ai.activeProviderId = providerId;
        config.ai.providers[providerId] = {
          provider: aiConfig.provider,
          baseURL: aiConfig.baseURL,
          apiKey: aiConfig.apiKey || '',
          model: aiConfig.model || '',
          temperature: aiConfig.temperature,
          max_tokens: aiConfig.max_tokens,
          timeoutMs: aiConfig.timeoutMs,
          systemPrompt: aiConfig.systemPrompt,
        };
      }
      console.log('[Config] Migrated ai-config.json');
    } catch (error) {
      console.error('[Config] Failed to migrate ai-config.json:', error);
    }
  }

  // 迁移 sync-config.json
  const syncConfigPath = path.join(userDataPath, 'sync-config.json');
  if (fs.existsSync(syncConfigPath)) {
    try {
      const syncConfig = JSON.parse(fs.readFileSync(syncConfigPath, 'utf-8'));
      if (syncConfig.webdav) {
        config.sync.providers.webdav = {
          url: syncConfig.webdav.url || '',
          username: syncConfig.webdav.username || '',
          password: syncConfig.webdav.password || '',
          remotePath: syncConfig.webdav.remotePath || '/InfinityNoteX',
          conflictStrategy: syncConfig.webdav.conflictStrategy || 'newest',
        };
      }
      console.log('[Config] Migrated sync-config.json');
    } catch (error) {
      console.error('[Config] Failed to migrate sync-config.json:', error);
    }
  }

  // 迁移 window-state.json
  const windowStatePath = path.join(userDataPath, 'window-state.json');
  if (fs.existsSync(windowStatePath)) {
    try {
      const windowState = JSON.parse(fs.readFileSync(windowStatePath, 'utf-8'));
      config.window = {
        width: windowState.width || 1200,
        height: windowState.height || 800,
        x: windowState.x,
        y: windowState.y,
        isMaximized: windowState.isMaximized || false,
      };
      console.log('[Config] Migrated window-state.json');
    } catch (error) {
      console.error('[Config] Failed to migrate window-state.json:', error);
    }
  }

  // 保存合并后的配置
  overwriteAppConfig(config);
  console.log('[Config] Legacy config migration completed');
}

/**
 * 清理旧配置文件（迁移完成后可选调用）
 */
export function cleanupLegacyConfigs(): void {
  const userDataPath = app.getPath('userData');
  const legacyFiles = ['ai-config.json', 'sync-config.json', 'window-state.json'];

  for (const file of legacyFiles) {
    const filePath = path.join(userDataPath, file);
    if (fs.existsSync(filePath)) {
      try {
        // 重命名为 .bak 而不是直接删除，以防万一
        fs.renameSync(filePath, filePath + '.bak');
        console.log(`[Config] Backed up legacy file: ${file}`);
      } catch (error) {
        console.error(`[Config] Failed to backup legacy file ${file}:`, error);
      }
    }
  }
}
