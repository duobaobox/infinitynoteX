import type { AIProviderConfig } from '../shared/types/config';

/**
 * AI 配置（用户在"AI 管理"中配置）
 * 扩展后端 Shared 类型，添加前端特有字段
 */
export interface AIConfig extends Omit<AIProviderConfig, 'apiKey'> {
  /** 预设的模型提供商 ID（用于自动填充配置） */
  providerId?: string; // e.g., 'deepseek', 'alibaba'

  /**
   * API Key（由主进程持有，渲染进程绝不访问）
   * 前端使用 undefined 表示未设置或未修改，后端配置中必须是 string
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
 * AI 消息（OpenAI 兼容格式）
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 聊天请求
 */
export interface ChatPayload {
  messages: AIMessage[];
  message: string; // 当前用户消息
  stream?: boolean;
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
