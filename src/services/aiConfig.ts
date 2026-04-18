import type { AIProviderConfig } from '../shared/types/config';
import type { NoteReference } from './types';

/**
 * AI 配置（用户在"AI 管理"中配置）
 * 扩展后端 Shared 类型，添加前端特有字段
 */
export interface AIConfig extends Omit<AIProviderConfig, 'apiKey'> {
  /** 预设的模型提供商 ID（用于自动填充配置） */
  providerId?: string; // e.g., 'deepseek', 'alibaba'

  /**
   * API Key（仅主进程持有明文）
   * 渲染进程拿到的只会是占位符或用户新输入的值
   */
  apiKey?: string;

  /** 是否启用流式响应 */
  stream?: boolean; // 默认 true
}

/**
 * API Key 占位符（用于渲染进程显示“已设置”，但不暴露明文）
 * 注意：主进程写入配置时遇到该值应保留旧 key。
 */
export const API_KEY_PLACEHOLDER = '********';

/**
 * 聊天消息（OpenAI 兼容格式，用于 API 请求）
 * 注意：与 types.ts 中的 AIMessage 不同，这是简化的 API 格式
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  references?: NoteReference[];
}

/**
 * 聊天请求
 */
export interface ChatPayload {
  messages: ChatMessage[];
  message: string; // 当前用户消息
  stream?: boolean;
  references?: NoteReference[];
  requestId?: string;
  /** 是否允许 AI 主动检索用户资料（便签 / 知识库） */
  allowActiveRetrieval?: boolean;
  /** RAG 检索上下文（可选） */
  ragContext?: {
    results: Array<{
      noteId: string;
      noteTitle: string;
      excerpt: string;
      score: number;
    }>;
  };
}

/**
 * 聊天响应（非流式）
 */
export interface ChatResponse {
  content: string;
  finishReason?: string;
}

/**
 * 流式数据块
 */
export interface StreamChunk {
  delta: string; // 文本增量
  reasoningDelta?: string; // 思维链增量（如 deepseek-reasoner 的 reasoning_content）
  finishReason?: string;
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  modelInfo?: {
    model: string;
    provider: string;
  };
}
