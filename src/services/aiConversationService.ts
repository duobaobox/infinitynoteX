/**
 * AI Conversation Service - AI 对话数据服务
 *
 * 封装 AI 对话相关的所有数据操作，提供统一的接口。
 */

import type { AIConversationPreview } from '../constants/tools';

// AI 消息类型（与 preload.ts 中的定义保持一致）
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  reasoning?: string;
  ragSources?: Array<{
    key: number;
    title: string;
    description?: string;
    noteId?: string;
  }>;
  references?: Array<{
    id: string;
    title: string;
    byteLength: number;
    content: string;
  }>;
}

class AIConversationService {
  /**
   * 获取所有 AI 对话列表
   */
  async getConversations(): Promise<AIConversationPreview[]> {
    return window.storage.getAIConversations();
  }

  /**
   * 创建新对话
   */
  async createConversation(title?: string): Promise<void> {
    await window.storage.createAIConversation(title);
  }

  /**
   * 删除对话
   */
  async deleteConversation(id: string): Promise<void> {
    await window.storage.deleteAIConversation(id);
  }

  /**
   * 更新对话标题
   */
  async updateTitle(id: string, title: string): Promise<void> {
    await window.storage.updateAIConversationTitle(id, title);
  }

  /**
   * 保存对话消息
   */
  async saveMessages(
    id: string,
    messages: AIMessage[],
    options?: { source?: 'note' | 'workbench' | 'global' },
  ): Promise<void> {
    await window.storage.saveAIConversationMessages(id, messages, options);
  }
}

// 导出单例实例
export const aiConversationService = new AIConversationService();

// 同时导出类型，便于测试时 mock
export type { AIConversationService };
