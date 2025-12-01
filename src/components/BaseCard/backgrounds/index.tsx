/**
 * BaseCard 背景系统
 *
 * 所有卡片背景装饰组件的统一入口
 *
 * 添加新背景类型：
 * 1. 在此目录创建 XxxBackground.tsx
 * 2. 在 backgrounds.css 中添加对应样式
 * 3. 在此文件导出
 * 4. 在 BackgroundRegistry 中注册
 */

import React from 'react';

// 背景组件
export { default as StackedBackground } from './StackedBackground';
export { default as RobotBackground } from './RobotBackground';
export { default as ChecklistBackground } from './ChecklistBackground';

// 类型
export type { StackedBackgroundProps } from './StackedBackground';
export type { RobotBackgroundProps } from './RobotBackground';
export type { ChecklistBackgroundProps } from './ChecklistBackground';

// 样式（供 BaseCard.css 导入）
import './backgrounds.css';

// ============================================================
// 背景注册表 - 集中管理所有背景类型
// ============================================================

import StackedBackground from './StackedBackground';
import RobotBackground from './RobotBackground';
import ChecklistBackground from './ChecklistBackground';

/** 内置背景类型 */
export type CardBackgroundType = 'stacked' | 'robot' | 'checklist' | 'none';

/** 背景组件注册表 */
const BackgroundRegistry: Record<string, React.FC<{ className?: string }>> = {
  stacked: StackedBackground,
  robot: RobotBackground,
  checklist: ChecklistBackground,
};

/**
 * 注册自定义背景组件
 * @param type 背景类型标识
 * @param component 背景组件
 */
export function registerBackground(type: string, component: React.FC<{ className?: string }>) {
  BackgroundRegistry[type] = component;
}

/**
 * 渲染卡片背景
 * @param type 背景类型
 * @returns 背景 React 节点
 */
export function renderCardBackground(type: CardBackgroundType | string): React.ReactNode {
  if (type === 'none') return null;

  const Component = BackgroundRegistry[type];
  if (!Component) {
    console.warn(`[BaseCard] Unknown background type: ${type}`);
    return null;
  }

  return <Component />;
}
