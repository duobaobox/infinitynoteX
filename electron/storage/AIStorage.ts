/**
 * AI 对话存储模块
 * 继承 BaseDirectoryStorage，添加 AI 对话特有的逻辑
 */

import type { StorageContext } from './StorageContext';
import type { AIConversation, AIConversationIndex, AIMessage } from './types';
import { StorageError, StorageErrorCode } from './errors';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';
import { generateId, generateConversationTitle } from './utils';

// 获取 ai-conversations 模块配置
const aiConfig = getModuleConfig('ai-conversations')!;

export class AIStorage extends BaseDirectoryStorage<AIConversation, AIConversationIndex> {
  constructor(context: StorageContext) {
    super(context.currentPath, context.tempDir, aiConfig);
  }

  // ============ AI 对话特有方法 ============

  /**
   * 获取所有 AI 对话（完整内容）
   */
  async getAll(): Promise<AIConversation[]> {
    const index = await this.list();
    const conversations = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.get(item.id);
        } catch (error) {
          console.error(`[AIStorage] Failed to read conversation ${item.id}:`, error);
          return null;
        }
      }),
    );

    return conversations.filter((item): item is AIConversation => item !== null);
  }

  /**
   * 创建 AI 对话
   */
  async createConversation(title?: string): Promise<AIConversation> {
    const now = Date.now();
    const defaultTitle = generateConversationTitle();

    const newConversation: AIConversation = {
      id: generateId(),
      title: title || defaultTitle,
      excerpt: '开始对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await this['writeFile'](newConversation);
    await this['addToIndex'](newConversation);

    return newConversation;
  }

  /**
   * 删除 AI 对话
   */
  async delete(id: string): Promise<void> {
    const index = await this.list();
    const metaIndex = index.findIndex((c) => c.id === id);

    if (metaIndex < 0) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Conversation not found: ${id}`);
    }

    // 调用父类删除方法
    await super.delete(id);
  }

  /**
   * 保存 AI 对话消息
   */
  async saveMessages(id: string, messages: AIMessage[]): Promise<AIConversation> {
    const conversation = await this.get(id);

    conversation.messages = messages.map((message, index) => ({
      ...message,
      id: message.id ?? `${message.role}-${message.timestamp}-${index}`,
    }));
    conversation.updatedAt = Date.now();

    // 更新摘要（使用最后一条用户消息）
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      conversation.excerpt = lastUserMessage.content.slice(0, 100);
    }

    await this['writeFile'](conversation);
    await this['updateIndex'](conversation);

    return conversation;
  }

  /**
   * 更新 AI 对话标题
   */
  async updateTitle(id: string, title: string): Promise<AIConversation> {
    return await this.update(id, { title } as Partial<AIConversation>);
  }

  // ============ 向后兼容方法 ============

  /**
   * 获取对话索引列表（别名）
   */
  async getIndex(): Promise<AIConversationIndex[]> {
    return await this.list();
  }

  // ============ 实现抽象方法 ============

  /**
   * 将 AIConversation 转换为 AIConversationIndex
   */
  protected toIndex(conversation: AIConversation): AIConversationIndex {
    return {
      id: conversation.id,
      title: conversation.title,
      excerpt: conversation.excerpt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * 创建默认数据
   */
  protected createDefaultData(
    id: string,
    now: number,
    payload: Partial<AIConversation>,
  ): AIConversation {
    return {
      id,
      title: payload.title || generateConversationTitle(),
      excerpt: payload.excerpt || '开始对话',
      messages: payload.messages || [],
      createdAt: now,
      updatedAt: now,
    };
  }
}
