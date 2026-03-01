/**
 * 网页看板卡片存储模块
 * 继承 BaseDirectoryStorage，管理内置网页看板卡片数据
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
  { name: '智谱清言', url: 'https://chatglm.cn', isBuiltIn: true, order: 2 },
  { name: '豆包', url: 'https://www.doubao.com', isBuiltIn: true, order: 3 },
  { name: 'Kimi', url: 'https://kimi.moonshot.cn', isBuiltIn: true, order: 4 },
  { name: '腾讯元宝', url: 'https://yuanbao.tencent.com', isBuiltIn: true, order: 5 },
  { name: '秘塔搜索', url: 'https://metaso.cn', isBuiltIn: true, order: 6 },
];

export class BrowserCardStorage extends BaseDirectoryStorage<BrowserCard, BrowserCardIndex> {
  constructor(context: StorageContext) {
    super(context.dataDir, context.tempDir, browserCardsConfig);
  }

  // ============ 网页看板卡片特有方法 ============

  /**
   * 获取所有网页看板卡片（完整内容，按 order 排序）
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
   * 初始化预设卡片（同步预设列表）
   * 开发阶段支持自动更新/同步内置卡片
   */
  async initializePresets(): Promise<void> {
    const existingCards = await this.getAll();
    const existingBuiltInIds = existingCards.filter((c) => c.isBuiltIn).map((c) => c.id);

    // 1. 同步 PRESET 列表（创建或更新）
    for (const preset of PRESET_BROWSER_CARDS) {
      // 通过 URL 或名称查找是否已存在（内置卡片通常没有固定 ID）
      const existing = existingCards.find(
        (c) => c.isBuiltIn && (c.url === preset.url || c.name === preset.name),
      );

      if (existing) {
        // 更新现有内置卡片（确保名称和 URL 最新）
        await this.update(existing.id, {
          ...preset,
        });
        // 从待清理列表中移除
        const index = existingBuiltInIds.indexOf(existing.id);
        if (index > -1) existingBuiltInIds.splice(index, 1);
      } else {
        // 创建新预设
        await this.create(preset);
      }
    }

    // 2. 清理已经不在预设列表中的内置卡片
    for (const id of existingBuiltInIds) {
      console.log(`[BrowserCardStorage] Removing deprecated preset: ${id}`);
      await this.delete(id);
    }

    console.log('[BrowserCardStorage] Synchronized preset browser cards');
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
