/**
 * AI 对话存储模块
 * 负责 AI 对话的 CRUD 操作
 */

import fs from 'node:fs/promises';
import type { StorageContext } from './StorageContext';
import type { AIConversation, AIConversationIndex, AIMessage } from './types';
import { StorageError, StorageErrorCode } from './errors';
import {
  generateId,
  readJsonFile,
  writeJsonFile,
  writeJsonFileAtomic,
  fileExists,
  generateConversationTitle,
} from './utils';
import { AIConversationSchema, AIConversationsIndexArraySchema } from './schemas';

export class AIStorage {
  private indexCache: AIConversationIndex[] | null = null;
  private context: StorageContext;

  constructor(context: StorageContext) {
    this.context = context;
  }

  /**
   * 获取所有 AI 对话
   */
  async getAll(): Promise<AIConversation[]> {
    const index = await this.getIndex();
    const conversations = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.readFile(item.id);
        } catch (error) {
          console.error(`[AIStorage] Failed to read conversation ${item.id}:`, error);
          return null;
        }
      }),
    );

    return conversations.filter((item): item is AIConversation => item !== null);
  }

  /**
   * 获取对话索引列表
   */
  async getIndex(): Promise<AIConversationIndex[]> {
    if (!this.indexCache) {
      await this.loadCache();
    }
    return this.indexCache || [];
  }

  /**
   * 创建 AI 对话
   */
  async create(title?: string): Promise<AIConversation> {
    const now = Date.now();
    const index = await this.getIndex();
    const isDefaultConversation = index.length === 0; // 如果没有对话，这是第一个（默认对话）

    // 生成默认标题
    const defaultTitle = generateConversationTitle();

    const newConversation: AIConversation = {
      id: generateId(),
      title: isDefaultConversation ? '默认对话' : title || defaultTitle,
      excerpt: '开始对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
      isDefault: isDefaultConversation, // 标记为默认对话
    };

    await this.writeFile(newConversation);

    index.push(this.toIndex(newConversation));
    await this.saveIndex(index);

    return newConversation;
  }

  /**
   * 获取单个对话
   */
  async get(id: string): Promise<AIConversation> {
    return await this.readFile(id);
  }

  /**
   * 删除 AI 对话
   */
  async delete(id: string): Promise<void> {
    const index = await this.getIndex();
    const metaIndex = index.findIndex((c) => c.id === id);

    if (metaIndex < 0) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Conversation not found: ${id}`);
    }

    // 禁止删除默认对话
    if (index[metaIndex].isDefault) {
      throw new StorageError(StorageErrorCode.E_FOLDER_SYSTEM, '无法删除默认对话');
    }

    const filePath = this.context.getAIConversationPath(id);
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);
    }

    index.splice(metaIndex, 1);
    await this.saveIndex(index);
  }

  /**
   * 保存 AI 对话消息
   */
  async saveMessages(id: string, messages: AIMessage[]): Promise<AIConversation> {
    const conversation = await this.readFile(id);

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

    await this.writeFile(conversation);
    await this.updateIndexEntry(conversation);

    return conversation;
  }

  /**
   * 更新 AI 对话标题
   */
  async updateTitle(id: string, title: string): Promise<AIConversation> {
    const conversation = await this.readFile(id);

    conversation.title = title;
    conversation.updatedAt = Date.now();
    await this.writeFile(conversation);

    await this.updateIndexEntry(conversation);

    return conversation;
  }

  /**
   * 确保只有一个默认对话
   * 用于修复可能存在的数据异常
   */
  async ensureSingleDefault(): Promise<void> {
    const index = await this.getIndex();
    const defaultEntries = index.filter((item) => item.isDefault);

    if (defaultEntries.length <= 1) {
      return;
    }

    // 按创建时间排序，保留最早的默认对话
    const sortedDefaults = [...defaultEntries].sort((a, b) => a.createdAt - b.createdAt);
    const keeperId = sortedDefaults[0].id;
    const demotedIds = sortedDefaults.slice(1).map((item) => item.id);

    for (const id of demotedIds) {
      try {
        const conversation = await this.readFile(id);
        let updatedTitle = conversation.title;
        if (updatedTitle === '默认对话') {
          updatedTitle = generateConversationTitle(conversation.createdAt);
        }

        conversation.isDefault = false;
        conversation.title = updatedTitle;
        conversation.updatedAt = Date.now();

        await this.writeFile(conversation);

        const meta = index.find((item) => item.id === id);
        if (meta) {
          meta.isDefault = false;
          meta.title = updatedTitle;
          meta.updatedAt = conversation.updatedAt;
          meta.excerpt = conversation.excerpt;
        }
      } catch (error) {
        console.warn(`[AIStorage] Failed to normalize default conversation ${id}:`, error);
      }
    }

    // 确保保留的默认对话标记正确
    const keeper = index.find((item) => item.id === keeperId);
    if (keeper && !keeper.isDefault) {
      keeper.isDefault = true;
    }

    await this.saveIndex(index);
  }

  /**
   * 加载缓存（使用 Schema 校验）
   */
  async loadCache(): Promise<void> {
    this.indexCache = await readJsonFile<AIConversationIndex[]>(
      this.context.aiConversationsIndexPath,
      [],
      AIConversationsIndexArraySchema,
    );
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.indexCache = null;
  }

  /**
   * 创建空索引文件
   */
  async createEmptyIndex(): Promise<void> {
    const exists = await fileExists(this.context.aiConversationsIndexPath);
    if (!exists) {
      await writeJsonFile(this.context.aiConversationsIndexPath, []);
    }
  }

  /**
   * 保存索引
   */
  private async saveIndex(index: AIConversationIndex[]): Promise<void> {
    await writeJsonFile(this.context.aiConversationsIndexPath, index);
    this.indexCache = index;
  }

  /**
   * 转换为索引项
   */
  private toIndex(conversation: AIConversation): AIConversationIndex {
    return {
      id: conversation.id,
      title: conversation.title,
      excerpt: conversation.excerpt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isDefault: conversation.isDefault,
    };
  }

  /**
   * 读取对话文件（使用 Schema 校验）
   */
  private async readFile(id: string): Promise<AIConversation> {
    const filePath = this.context.getAIConversationPath(id);
    const exists = await fileExists(filePath);

    if (!exists) {
      throw new StorageError(StorageErrorCode.E_NOT_FOUND, `Conversation not found: ${id}`);
    }

    return await readJsonFile<AIConversation>(filePath, undefined, AIConversationSchema);
  }

  /**
   * 写入对话文件
   */
  private async writeFile(conversation: AIConversation): Promise<void> {
    const filePath = this.context.getAIConversationPath(conversation.id);
    await writeJsonFileAtomic(filePath, conversation, this.context.tempDir);
  }

  /**
   * 更新索引条目
   */
  private async updateIndexEntry(conversation: AIConversation): Promise<void> {
    const index = await this.getIndex();
    const meta = this.toIndex(conversation);
    const existingIndex = index.findIndex((item) => item.id === conversation.id);

    if (existingIndex >= 0) {
      index[existingIndex] = meta;
    } else {
      index.push(meta);
    }

    await this.saveIndex(index);
  }
}
