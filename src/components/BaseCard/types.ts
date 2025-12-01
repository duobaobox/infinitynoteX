/**
 * BaseCard 类型定义
 * 可扩展的卡片组件接口设计
 */

import type { ReactNode } from 'react';
import type { NoteCardColor } from '../../hooks/useNoteCardTheme';

/**
 * 内置背景类型
 * - stacked: 堆叠便签卡片效果（用于便签）
 * - robot: 机器人图标（用于AI对话）
 * - none: 无背景装饰
 */
export type CardBackgroundType = 'stacked' | 'robot' | 'none';

/**
 * 卡片特性配置
 * 通过特性开关控制卡片功能
 */
export interface CardFeatures {
  /** 是否支持钉住/悬浮功能 */
  pinnable?: boolean;
  /** 是否显示颜色（影响背景色计算） */
  colorable?: boolean;
}

/**
 * BaseCard Props
 * 统一的卡片组件接口
 */
export interface BaseCardProps {
  /** 卡片唯一标识 */
  id?: string;
  /** 标题 */
  title: string;
  /** 内容摘要 */
  content: string;
  /** 卡片颜色（仅当 colorable=true 时生效） */
  color?: NoteCardColor;
  /** 背景装饰类型 */
  backgroundType?: CardBackgroundType;
  /** 自定义背景渲染（优先级高于 backgroundType） */
  renderBackground?: () => ReactNode;
  /** 特性配置 */
  features?: CardFeatures;
  /** 点击回调 */
  onClick?: () => void;
  /** 钉住/悬浮回调（仅当 features.pinnable=true 时显示按钮） */
  onPin?: () => void;
  /** 右上角操作区（如删除按钮等） */
  actions?: ReactNode;
  /** 额外渲染内容（扩展预留） */
  extra?: ReactNode;
  /** 自定义 className */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * NoteCard Props（便签卡片特化）
 */
export interface NoteCardProps {
  id?: string;
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  onPin?: () => void;
  actions?: ReactNode;
}

/**
 * ConversationCard Props（AI对话卡片特化）
 */
export interface ConversationCardProps {
  id?: string;
  title: string;
  content: string;
  onClick?: () => void;
  actions?: ReactNode;
}
