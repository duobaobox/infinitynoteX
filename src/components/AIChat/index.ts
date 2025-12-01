/**
 * AIChat - AI 对话组件
 *
 * 可复用的 AI 对话组件，用于：
 * - AI 工作台的对话面板
 * - 便签编辑器的 AI Tab
 *
 * 使用示例：
 * ```tsx
 * import { AIChatPanel } from '@/components/AIChat';
 *
 * <AIChatPanel
 *   conversationId={selectedConversationId}
 *   onTitleChange={(title) => console.log('Title changed:', title)}
 * />
 * ```
 */

// 核心组件
export { AIChatPanel } from './core/AIChatPanel';
export { default } from './core/AIChatPanel';

// Hooks
export { useAIConfig, useAIChat } from './hooks';

// 工具函数
export {
  renderMarkdownToHtml,
  convertMarkdownToTipTap,
  splitParagraphs,
  copyToClipboard,
} from './utils';

// 类型定义
export type {
  ChatItem,
  AIMessageData,
  ProviderOption,
  StreamChunkData,
  StreamErrorPayload,
  AIChatPanelProps,
  UseAIChatReturn,
  UseAIConfigReturn,
  ThoughtChainItems,
} from './types';
