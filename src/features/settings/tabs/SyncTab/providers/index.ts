/**
 * Sync Provider注册中心
 * 在这里注册所有可用的sync providers
 * 通过注释/取消注释来启用/禁用provider
 */

import type { SyncProvider } from './types';

// 导入所有providers
import { WebDAVProvider } from './WebDAVProvider';
// import { SupabaseProvider } from './SupabaseProvider';
// import { YjsProvider } from './YjsProvider';
// import { FileSyncProvider } from './FileSyncProvider';

/**
 * Provider注册表
 * 按需启用/禁用provider（注释/取消注释）
 */
export const SYNC_PROVIDERS: SyncProvider[] = [
  WebDAVProvider,
  // SupabaseProvider,  // 即将推出
  // YjsProvider,       // 即将推出
  // FileSyncProvider,  // 即将推出
];

/**
 * 获取所有已启用的providers
 */
export const getAvailableProviders = (): SyncProvider[] => {
  return SYNC_PROVIDERS.filter((p) => p.enabled);
};

/**
 * 根据ID获取provider
 */
export const getProviderById = (id: string): SyncProvider | undefined => {
  return SYNC_PROVIDERS.find((p) => p.id === id);
};

/**
 * 获取所有provider IDs
 */
export const getAllProviderIds = (): string[] => {
  return SYNC_PROVIDERS.map((p) => p.id);
};
