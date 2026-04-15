/**
 * AI 对话存储模块
 * 继承 BaseDirectoryStorage，添加 AI 对话特有的逻辑
 */

import type { StorageContext } from './StorageContext';
import type { AIConversation, AIConversationIndex, AIMessage } from './types';
import type { IndexCache } from './core/IndexCache';
import { StorageError, StorageErrorCode } from './errors';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';
import { generateId, generateConversationTitle } from './utils';

// 获取 ai-conversations 模块配置
const aiConfig = getModuleConfig('ai-conversations')!;
const DEFAULT_GLOBAL_BINDING_ID = 'default';
type BoundConversationSource = 'note' | 'global';

export class AIStorage extends BaseDirectoryStorage<AIConversation, AIConversationIndex> {
  constructor(context: StorageContext, indexCache: IndexCache) {
    super(context.dataDir, context.tempDir, aiConfig, indexCache);
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
   * 获取 AI 对话预览列表（不加载完整消息正文）
   */
  async listPreviews(): Promise<AIConversationIndex[]> {
    return await this.list();
  }

  /**
   * 获取单个 AI 对话完整内容
   */
  async getConversation(id: string): Promise<AIConversation> {
    return await this.get(id);
  }

  /**
   * 根据绑定关系查找或创建对话
   */
  async resolveBinding(
    source: BoundConversationSource,
    sourceEntityId: string,
    options?: { autoCreate?: boolean; title?: string },
  ): Promise<AIConversation | null> {
    const normalizedSourceEntityId =
      source === 'global' ? this.normalizeGlobalBindingId(sourceEntityId) : sourceEntityId;
    const index = await this.list();
    const existing = [...index]
      .reverse()
      .find((conversation) =>
        this.matchesSourceEntity(conversation, source, normalizedSourceEntityId),
      );

    if (existing) {
      const conversation = await this.get(existing.id);
      const patch = this.buildBindingRepairPatch(conversation, source, normalizedSourceEntityId);

      if (patch) {
        return await this.update(existing.id, patch);
      }

      return conversation;
    }

    if (!options?.autoCreate) {
      return null;
    }

    return await this.createConversation(options?.title, {
      source,
      sourceEntityId: normalizedSourceEntityId,
    });
  }

  /**
   * 创建 AI 对话
   */
  async createConversation(
    title?: string,
    options?: { source?: AIConversation['source']; sourceEntityId?: string },
  ): Promise<AIConversation> {
    const now = Date.now();
    const defaultTitle = generateConversationTitle();

    const newConversation: AIConversation = {
      id: generateId(),
      title: title || defaultTitle,
      excerpt: '开始对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
      source: options?.source,
      sourceEntityId: options?.sourceEntityId,
    };

    await this.writeFile(newConversation);
    this.addToIndex(newConversation);

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
   * 如果对话不存在，会自动创建（支持便签、悬浮窗等场景）
   */
  async saveMessages(
    id: string,
    messages: AIMessage[],
    options?: {
      source?: 'note' | 'workbench' | 'canvas' | 'global';
      sourceEntityId?: string;
    },
  ): Promise<AIConversation> {
    let conversation: AIConversation;

    try {
      conversation = await this.get(id);
    } catch (error) {
      // 对话不存在，自动创建
      // BaseStorage.get 抛出的是普通 Error，消息格式为 "AI 对话 not found: xxx"
      const isNotFound =
        (error instanceof StorageError && error.code === StorageErrorCode.E_NOT_FOUND) ||
        (error instanceof Error && error.message.includes('not found'));

      if (isNotFound) {
        const now = Date.now();
        // 从消息中提取第一条用户消息作为标题
        const firstUserMessage = messages.find((m) => m.role === 'user');
        const title = firstUserMessage
          ? firstUserMessage.content.slice(0, 30) +
            (firstUserMessage.content.length > 30 ? '...' : '')
          : generateConversationTitle();

        conversation = {
          id, // 兼容直接按 conversationId 持久化的调用路径
          title,
          excerpt: '开始对话',
          messages: [],
          createdAt: now,
          updatedAt: now,
          source: options?.source, // 保存对话来源
          sourceEntityId: options?.sourceEntityId,
        };

        // 写入文件并添加到索引
        await this.writeFile(conversation);
        this.addToIndex(conversation);
      } else {
        throw error;
      }
    }

    conversation.messages = messages.map((message, index) => ({
      ...message,
      id: message.id ?? `${message.role}-${message.timestamp}-${index}`,
    }));
    conversation.updatedAt = Date.now();

    // 保留或更新 source 字段（如果传入了新的 source，则更新；否则保留原有值）
    if (options?.source) {
      conversation.source = options.source;
    }
    if (options?.sourceEntityId) {
      conversation.sourceEntityId =
        options.source === 'global'
          ? this.normalizeGlobalBindingId(options.sourceEntityId)
          : options.sourceEntityId;
    }

    // 更新摘要（使用最后一条用户消息）
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      conversation.excerpt = lastUserMessage.content.slice(0, 100);
    }

    await this.writeFile(conversation);
    this.updateIndexItem(conversation);

    return conversation;
  }

  /**
   * 更新 AI 对话标题
   */
  async updateTitle(id: string, title: string): Promise<AIConversation> {
    return await this.update(id, { title } as Partial<AIConversation>);
  }

  /**
   * 将绑定在旧实体 ID 上的对话迁移到新实体 ID
   */
  async rebindSourceEntity(
    source: BoundConversationSource,
    fromEntityId: string,
    toEntityId: string,
  ): Promise<number> {
    const index = await this.list();
    const conversations = index.filter((conversation) =>
      this.matchesSourceEntity(conversation, source, fromEntityId),
    );

    for (const conversation of conversations) {
      await this.update(conversation.id, {
        source,
        sourceEntityId:
          source === 'global' ? this.normalizeGlobalBindingId(toEntityId) : toEntityId,
      } as Partial<AIConversation>);
    }

    return conversations.length;
  }

  /**
   * 删除指定绑定实体关联的对话
   */
  async deleteBySourceEntity(source: BoundConversationSource, entityId: string): Promise<number> {
    const index = await this.list();
    const conversations = index.filter((conversation) =>
      this.matchesSourceEntity(conversation, source, entityId),
    );

    for (const conversation of conversations) {
      await super.delete(conversation.id);
    }

    return conversations.length;
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
      source: conversation.source,
      sourceEntityId: conversation.sourceEntityId,
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
      source: payload.source, // 保留 source
      sourceEntityId: payload.sourceEntityId,
    };
  }

  /**
   * 验证对话的 source 字段完整性
   * 用于检查和修复数据一致性
   */
  async validateIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    const conversations = await this.getAll();

    for (const conversation of conversations) {
      const patch: Partial<AIConversation> = {};
      // 检查 source 字段是否存在且有效
      const validSources = ['note', 'workbench', 'canvas', 'global'];
      if (!conversation.source || !validSources.includes(conversation.source)) {
        issues.push(
          `Conversation ${conversation.id} has invalid or missing source: ${conversation.source}`,
        );

        // 自动修复：根据 conversationId 推断 source
        if (conversation.id === 'global-ai-chat') {
          patch.source = 'global';
        } else {
          // 无法确定来源，设置为 workbench（默认）
          patch.source = 'workbench';
        }
      }

      const nextSource = patch.source ?? conversation.source;
      if (nextSource === 'note' && !conversation.sourceEntityId) {
        patch.sourceEntityId = conversation.id;
        issues.push(`Conversation ${conversation.id} was missing sourceEntityId for note binding`);
      }

      if (nextSource === 'global' && !conversation.sourceEntityId) {
        patch.sourceEntityId = DEFAULT_GLOBAL_BINDING_ID;
        issues.push(
          `Conversation ${conversation.id} was missing sourceEntityId for global binding`,
        );
      }

      if (Object.keys(patch).length > 0) {
        await this.update(conversation.id, patch);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private normalizeGlobalBindingId(sourceEntityId: string): string {
    return sourceEntityId || DEFAULT_GLOBAL_BINDING_ID;
  }

  private matchesSourceEntity(
    conversation: Pick<AIConversation, 'id' | 'source' | 'sourceEntityId'>,
    source: BoundConversationSource,
    sourceEntityId: string,
  ): boolean {
    const normalizedSourceEntityId =
      source === 'global' ? this.normalizeGlobalBindingId(sourceEntityId) : sourceEntityId;

    if (conversation.source !== source) {
      return false;
    }

    if (conversation.sourceEntityId === normalizedSourceEntityId) {
      return true;
    }

    // 兼容旧数据：历史上 note/global 对话直接复用了业务实体 ID
    if (!conversation.sourceEntityId && source === 'note') {
      return conversation.id === normalizedSourceEntityId;
    }

    if (!conversation.sourceEntityId && source === 'global') {
      return conversation.id === 'global-ai-chat';
    }

    return false;
  }

  private buildBindingRepairPatch(
    conversation: AIConversation,
    source: BoundConversationSource,
    sourceEntityId: string,
  ): Partial<AIConversation> | null {
    const patch: Partial<AIConversation> = {};
    const normalizedSourceEntityId =
      source === 'global' ? this.normalizeGlobalBindingId(sourceEntityId) : sourceEntityId;

    if (conversation.source !== source) {
      patch.source = source;
    }

    if (conversation.sourceEntityId !== normalizedSourceEntityId) {
      patch.sourceEntityId = normalizedSourceEntityId;
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }
}
