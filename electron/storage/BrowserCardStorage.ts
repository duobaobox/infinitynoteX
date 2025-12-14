/**
 * 浏览器卡片存储模块
 * 继承 BaseDirectoryStorage，管理内置浏览器网页卡片数据
 */

import type { StorageContext } from './StorageContext';
import type { BrowserCard, BrowserCardIndex } from './types';
import { BaseDirectoryStorage } from './core/BaseStorage';
import { getModuleConfig } from './core/moduleRegistry';

// 获取 browser-cards 模块配置
const browserCardsConfig = getModuleConfig('browser-cards')!;

// 预设的 AI 网站列表
const PRESET_BROWSER_CARDS: Omit<BrowserCard, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: '通义千问', url: 'https://www.qianwen.com', isBuiltIn: true, order: 0 },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com', isBuiltIn: true, order: 1 },
  { name: '豆包', url: 'https://www.doubao.com', isBuiltIn: true, order: 2 },
  { name: '智谱清言', url: 'https://chatglm.cn', isBuiltIn: true, order: 3 },
  { name: 'Kimi', url: 'https://kimi.moonshot.cn', isBuiltIn: true, order: 4 },
  { name: 'Gemini', url: 'https://gemini.google.com', isBuiltIn: true, order: 5 },
  { name: 'Copilot', url: 'https://copilot.microsoft.com', isBuiltIn: true, order: 6 },
  { name: 'ChatGPT', url: 'https://chat.openai.com', isBuiltIn: true, order: 7 },
];

export class BrowserCardStorage extends BaseDirectoryStorage<BrowserCard, BrowserCardIndex> {
  constructor(context: StorageContext) {
    super(context.dataDir, context.tempDir, browserCardsConfig);
  }

  // ============ 浏览器卡片特有方法 ============

  /**
   * 获取所有浏览器卡片（完整内容，按 order 排序）
   */
  async getAll(): Promise<BrowserCard[]> {
    const index = await this.list();
    const cards = await Promise.all(
      index.map(async (item) => {
        try {
          return await this.get(item.id);
        } catch (error) {
          console.error(`[BrowserCardStorage] Failed to read card ${item.id}:`, error);
          return null;
        }
      }),
    );

    return cards
      .filter((item): item is BrowserCard => item !== null)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * 初始化预设卡片（首次使用时调用）
   */
  async initializePresets(): Promise<void> {
    const existingCards = await this.list();
    if (existingCards.length > 0) {
      return; // 已有卡片，不再初始化
    }

    for (const preset of PRESET_BROWSER_CARDS) {
      await this.create(preset);
    }
    console.log('[BrowserCardStorage] Initialized preset browser cards');
  }

  /**
   * 重新排序卡片
   */
  async reorder(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.update(orderedIds[i], { order: i });
    }
  }

  /**
   * 获取下一个可用的 order 值
   */
  async getNextOrder(): Promise<number> {
    const cards = await this.getAll();
    if (cards.length === 0) return 0;
    return Math.max(...cards.map((c) => c.order)) + 1;
  }

  // ============ 实现抽象方法 ============

  /**
   * 将 BrowserCard 转换为 BrowserCardIndex
   */
  protected toIndex(card: BrowserCard): BrowserCardIndex {
    return {
      id: card.id,
      name: card.name,
      url: card.url,
      icon: card.icon,
      order: card.order,
      updatedAt: card.updatedAt,
    };
  }

  /**
   * 创建默认数据
   */
  protected createDefaultData(id: string, now: number, payload: Partial<BrowserCard>): BrowserCard {
    return {
      id,
      name: payload.name || '新网页',
      url: payload.url || 'https://example.com',
      icon: payload.icon,
      isBuiltIn: payload.isBuiltIn ?? false,
      order: payload.order ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}
