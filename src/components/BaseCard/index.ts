/**
 * BaseCard 导出文件
 *
 * 统一导出：
 * - BaseCard 核心组件
 * - 所有特化卡片组件（NoteCard、ConversationCard 等）
 * - 类型定义和 Hook
 */

// 核心组件
export { default as BaseCard } from './BaseCard';
export { default } from './BaseCard';

// 背景渲染器
export { CardBackgroundRenderer } from './CardBackgroundRenderer';

// 卡片组件
export { NoteCard } from './cards/NoteCard';
export type { NoteCardProps } from './cards/NoteCard';
export { ConversationCard } from './cards/ConversationCard';
export type { AIConversationCardProps } from './cards/ConversationCard';

// Hook
export { useCardTheme } from './useCardTheme';

// 类型
export type {
  BaseCardProps,
  CardBackgroundType,
  CardFeatures,
  ConversationCardProps,
} from './types';
