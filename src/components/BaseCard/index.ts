/**
 * BaseCard 卡片组件系统
 *
 * 结构：
 * - BaseCard.tsx         基础模板（所有核心逻辑）
 * - backgrounds/         背景装饰组件（统一管理）
 * - NoteCard.tsx         便签卡片（配置文件）
 * - ConversationCard.tsx 对话卡片（配置文件）
 * - TodoCard.tsx         待办卡片（配置文件）
 *
 * 扩展新卡片（只需 1 步）：
 * 1. 复制 NoteCard.tsx，修改 backgroundType
 * 2. 在此文件导出
 *
 * 扩展新背景（只需 2 步）：
 * 1. 在 backgrounds/ 创建组件和样式
 * 2. 在 backgrounds/index.ts 注册
 */

// 基础组件
export { default as BaseCard, default } from './BaseCard';
export { CardListContext } from './BaseCard';
export type { BaseCardProps, CardListContextValue } from './BaseCard';

// 背景系统
export {
  renderCardBackground,
  registerBackground,
  StackedBackground,
  RobotBackground,
  ChecklistBackground,
} from './backgrounds';
export type { CardBackgroundType } from './backgrounds';

// 特化卡片
export { default as NoteCard } from './NoteCard';
export type { NoteCardProps } from './NoteCard';

export { default as ConversationCard } from './ConversationCard';
export type { ConversationCardProps } from './ConversationCard';

export { default as TodoCard } from './TodoCard';
export type { TodoCardProps } from './TodoCard';
