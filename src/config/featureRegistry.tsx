/**
 * Feature Registry - 功能模块注册中心
 *
 * 设计目标:
 * - 解耦 Layout 组件与具体 Feature 实现
 * - 遵循开闭原则：添加新功能只需注册，无需修改 Layout
 * - 支持两层结构：Workspace (note/tool) 和 Tool (ai-chat/todo/...)
 */

import type { ReactNode, FC } from 'react';

// ============ 类型定义 ============

export type WorkspaceViewType = 'note' | 'tool';

export interface FeatureConfig {
  /** 功能唯一标识 */
  id: string;
  /** 所属工作区视图 */
  workspaceView: WorkspaceViewType;
  /** 显示名称 */
  name: string;
  /** 图标 */
  icon: ReactNode;
  /** 列表视图组件 */
  ListView: FC<{ flex: string | number }>;
  /** 编辑器视图组件 */
  EditorView: FC;
}

// ============ 注册表 ============

const registry: FeatureConfig[] = [];

/**
 * 注册一个 Feature
 * 应在各模块的 index.ts 中调用
 */
export const registerFeature = (config: FeatureConfig): void => {
  // 防止重复注册
  if (registry.some((f) => f.id === config.id)) {
    console.warn(`[FeatureRegistry] Feature "${config.id}" is already registered.`);
    return;
  }
  registry.push(config);
};

// ============ 查询 API ============

/**
 * 根据 ID 获取 Feature 配置
 */
export const getFeatureById = (id: string): FeatureConfig | undefined => {
  return registry.find((f) => f.id === id);
};

/**
 * 获取指定 WorkspaceView 下的所有 Feature
 */
export const getFeaturesByWorkspaceView = (view: WorkspaceViewType): FeatureConfig[] => {
  return registry.filter((f) => f.workspaceView === view);
};

/**
 * 根据当前 workspaceView 和 selectedToolId 获取激活的 Feature
 * - note 模式: 返回 id='note' 的 Feature
 * - tool 模式: 根据 selectedToolId 查找，若无则返回第一个 tool 类型 Feature
 */
export const getActiveFeature = (
  workspaceView: WorkspaceViewType,
  selectedToolId: string | null,
): FeatureConfig | undefined => {
  if (workspaceView === 'note') {
    return registry.find((f) => f.id === 'note');
  }
  // 工坊模式
  if (selectedToolId) {
    return registry.find((f) => f.id === selectedToolId);
  }
  // 默认返回第一个工具
  return getFeaturesByWorkspaceView('tool')[0];
};

/**
 * 获取所有已注册的 Feature
 */
export const getAllFeatures = (): FeatureConfig[] => {
  return [...registry];
};
