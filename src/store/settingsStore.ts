/**
 * Settings Store - 使用 Zustand Slices 模式管理设置相关状态
 *
 * 架构说明：
 * - 状态按领域拆分为独立的 slices（Appearance、AIConfig、Storage、Sync、App）
 * - 每个 slice 负责自己领域的状态和 actions
 * - 主 store 组合所有 slices，提供统一的访问入口
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  AppearanceSlice,
  createAppearanceSlice,
  AIConfigSlice,
  createAIConfigSlice,
  StorageSlice,
  createStorageSlice,
  SyncSlice,
  createSyncSlice,
  AppSlice,
  createAppSlice,
  KnowledgeSlice,
  createKnowledgeSlice,
} from './slices';

// 从 slices 重导出常用类型和工具函数
export {
  type ProviderStatus,
  PROVIDER_STATUS_META,
  getProviderStatus,
  isConfigReady,
} from './slices/aiConfigSlice';

export { DEFAULT_EXTERNAL_AI_URL } from './slices/appSlice';

// ============ 组合所有 Slices 的完整状态类型 ============
export type SettingsState = AppearanceSlice &
  AIConfigSlice &
  StorageSlice &
  SyncSlice &
  AppSlice &
  KnowledgeSlice;

// ============ 创建组合 Store ============
export const useSettingsStore = create<SettingsState>()(
  devtools(
    (...a) => ({
      ...createAppearanceSlice(...a),
      ...createAIConfigSlice(...a),
      ...createStorageSlice(...a),
      ...createSyncSlice(...a),
      ...createAppSlice(...a),
      ...createKnowledgeSlice(...a),
    }),
    {
      name: 'SettingsStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
