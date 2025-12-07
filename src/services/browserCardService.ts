/**
 * Browser Card Service - 浏览器卡片数据服务
 *
 * 封装浏览器卡片相关的所有数据操作，提供统一的接口。
 * 参考 aiConversationService.ts 实现。
 */

// 浏览器卡片类型
export interface BrowserCard {
  id: string;
  name: string;
  url: string;
  icon?: string;
  isBuiltIn?: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

class BrowserCardService {
  /**
   * 获取所有浏览器卡片列表
   */
  async getCards(): Promise<BrowserCard[]> {
    return window.browserCards.list();
  }

  /**
   * 创建新卡片
   */
  async createCard(card: { name: string; url: string; icon?: string }): Promise<BrowserCard> {
    return window.browserCards.create(card);
  }

  /**
   * 更新卡片
   */
  async updateCard(
    id: string,
    patch: { name?: string; url?: string; icon?: string },
  ): Promise<BrowserCard> {
    return window.browserCards.update(id, patch);
  }

  /**
   * 删除卡片
   */
  async deleteCard(id: string): Promise<void> {
    await window.browserCards.delete(id);
  }

  /**
   * 重新排序卡片
   */
  async reorderCards(orderedIds: string[]): Promise<void> {
    await window.browserCards.reorder(orderedIds);
  }
}

// 导出单例实例
export const browserCardService = new BrowserCardService();

// 同时导出类型，便于测试时 mock
export type { BrowserCardService };
