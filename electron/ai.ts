/**
 * 主进程 AI 模块统一出口（barrel）
 * - 配置读写：electron/ai/config.ts
 * - OpenAI 兼容适配器：electron/ai/adapter.ts
 */

export { readAIConfig, writeAIConfig } from './ai/config';
export { OpenAICompatibleAdapter, createAdapter } from './ai/adapter';
