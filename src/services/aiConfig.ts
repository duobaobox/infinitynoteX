/**
 * AI 配置与类型定义
 * 支持任何 OpenAI 兼容的模型（包括 Ollama、本地服务等）
 */

/**
 * AI 配置（用户在"AI 管理"中配置）
 */
export interface AIConfig {
  /** 预设的模型提供商 ID（用于自动填充配置） */
  providerId?: string; // e.g., 'deepseek', 'alibaba'
  /** 模型提供商（用于 UI 展示与区分） */
  provider: string; // e.g., 'openai', 'ollama', 'qwen', 'azure', 'custom'
  /** API 基础 URL，支持任意 OpenAI 兼容服务 */
  baseURL: string; // e.g., 'https://api.openai.com/v1', 'http://localhost:11434/v1'
  /** API Key（由主进程持有，渲染进程绝不访问） */
  apiKey?: string;
  /** 模型名称 */
  model: string; // e.g., 'gpt-4o', 'mistral', 'llama2'
  /** 是否启用流式响应 */
  stream?: boolean; // 默认 true
  /** 温度参数（0-2） */
  temperature?: number; // 默认 0.7
  /** 最大 Token 数 */
  max_tokens?: number;
  /** System Prompt */
  systemPrompt?: string;
  /** 超时时间（毫秒） */
  timeoutMs?: number; // 默认 60000
  /** HTTP 代理（可选） */
  httpProxy?: string;
}

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
