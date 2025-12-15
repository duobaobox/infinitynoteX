/**
 * SyncTab Provider接口定义
 * 每个同步provider需要实现这些接口
 */

import React from 'react';
import type { z } from 'zod';

/**
 * Provider能力定义
 */
export interface SyncProviderCapabilities {
  /** 支持自动同步 */
  autoSync: boolean;
  /** 支持冲突解决 */
  conflictResolution: boolean;
  /** 支持双向同步 */
  bidirectional: boolean;
}

/**
 * Provider配置组件Props
 */
export interface SyncProviderConfigProps<T = any> {
  /** Provider定义 */
  provider: SyncProvider<T>;
  /** 当前配置 */
  config: T | null;
  /** 配置变更回调 */
  onConfigChange: (config: T) => void;
  /** 测试连接回调 */
  onTest: () => Promise<{ ok: boolean; message: string }>;
  /** 触发同步回调 */
  onSync: () => Promise<any>;
}

/**
 * 同步Provider定义
 */
export interface SyncProvider<T = any> {
  /** Provider唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标（emoji或icon name） */
  icon: string;
  /** 描述 */
  description: string;
  /** 状态 */
  status: 'ready' | 'upcoming';
  /** 是否启用此provider */
  enabled: boolean;

  /** 配置UI组件 */
  ConfigComponent: React.ComponentType<SyncProviderConfigProps<T>>;

  /** Provider功能能力 */
  capabilities: SyncProviderCapabilities;

  /** 配置数据Schema（可选，用于验证） */
  configSchema?: z.ZodSchema<T>;

  /** IPC handler名称（主进程同步逻辑） */
  syncHandler?: string;
}
