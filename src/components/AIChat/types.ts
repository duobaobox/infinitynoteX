/**
 * AIChat Types - AI 对话核心类型定义
 */

/**
 * 便签引用（用户引用的便签）
 */
export interface NoteReference {
  id: string;
  title: string;
  byteLength: number;
  content: string; // 便签纯文本内容，用于发送给 AI
}

/**
 * 聊天消息项（UI 层使用）
 * content 包含完整的 Markdown 内容，可能包含 <think> 标签
 */
export interface ChatItem {
  key: string;
  role: 'user' | 'ai';
  content: string; // 包含 <think> 标签的完整内容
  timestamp: number;
  isStreaming?: boolean;
  /** 用户引用的便签（仅用户消息） */
  references?: NoteReference[];
  /** RAG 检索来源（用于 AI 回复中的引用展示） */
  ragSources?: Array<{
    key: number;
    title: string;
    description?: string;
    noteId?: string;
  }>;
}

/**
 * AI 消息（存储层使用）
 */
export interface AIMessageData {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  reasoning?: string;
}

/**
 * Provider 选项
 */
export interface ProviderOption {
  providerId: string;
  config: import('../../services/aiConfig').AIConfig;
}

/**
 * 流式数据块
 */
export interface StreamChunkData {
  delta: string;
  reasoningDelta?: string;
  finishReason?: string;
}

/**
 * 流式错误
 */
export interface StreamErrorPayload {
  error?: string;
}

/**
 * AI Chat 组件 Props
 */
export interface AIChatPanelProps {
  /** 对话 ID */
  conversationId: string | null;
  /** 对话标题 */
  title?: string;
  /** 标题变更回调 */
  onTitleChange?: (title: string) => void;
  /** 是否显示标题编辑功能 */
  showTitleEditor?: boolean;
  /** 自定义 className */
  className?: string;
}

/**
 * useAIChat Hook 返回值
 */
export interface UseAIChatReturn {
  chatItems: ChatItem[];
  isLoading: boolean;
  isLoadingHistory: boolean; // 是否正在加载历史记录
  error: string | null;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: (text: string, references?: NoteReference[]) => Promise<void>;
  abort: () => void;
  clearChat: () => void;
  clearError: () => void;
}

/**
 * useAIConfig Hook 返回值
 */
export interface UseAIConfigReturn {
  isConfigured: boolean;
  isInitializing: boolean;
  config: import('../../services/aiConfig').AIConfig | null;
  providerOptions: ProviderOption[];
  currentProviderId: string;
  switchProvider: (providerId: string) => Promise<void>;
  isSwitching: boolean;
}
