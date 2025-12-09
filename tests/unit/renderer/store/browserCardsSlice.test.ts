/**
 * browserCardsSlice 测试
 * 覆盖加载、创建、更新、删除及选中逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createBrowserCardsSlice } from '../../../../src/store/slices/browserCardsSlice';
import type { BrowserCardsSlice } from '../../../../src/store/slices/browserCardsSlice';
import type { UISlice } from '../../../../src/store/slices/uiSlice';

const mockService = vi.hoisted(() => ({
  getCards: vi.fn(),
  createCard: vi.fn(),
  deleteCard: vi.fn(),
  updateCard: vi.fn(),
}));

vi.mock('../../../../src/services', () => ({
  browserCardService: mockService,
}));

type TestStore = BrowserCardsSlice & UISlice;

const createTestStore = (initialState: Partial<TestStore> = {}) => {
  return createStore<TestStore>((set, get, api) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slice = createBrowserCardsSlice(set as any, get as any, api as any);
    return {
      showEditor: false,
      ...slice,
      ...initialState,
    } as TestStore;
  });
};

const card = (id: string) => ({
  id,
  name: `card-${id}`,
  url: `https://example.com/${id}`,
  order: 0,
  createdAt: 1,
  updatedAt: 1,
});

describe('browserCardsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setBrowserCards 应设置列表', () => {
    const store = createTestStore();
    const list = [card('1')];
    store.getState().setBrowserCards(list);
    expect(store.getState().browserCards).toEqual(list);
  });

  it('selectBrowserCard 应设置选中并控制编辑器显示', () => {
    const store = createTestStore();
    store.getState().selectBrowserCard('1');
    expect(store.getState().selectedBrowserCardId).toBe('1');
    expect(store.getState().showEditor).toBe(true);

    store.getState().selectBrowserCard(null);
    expect(store.getState().selectedBrowserCardId).toBeNull();
    expect(store.getState().showEditor).toBe(false);
  });

  it('loadBrowserCards 应调用服务并填充列表', async () => {
    const list = [card('1')];
    mockService.getCards.mockResolvedValue(list);
    const store = createTestStore();

    await store.getState().loadBrowserCards();

    expect(mockService.getCards).toHaveBeenCalled();
    expect(store.getState().browserCards).toEqual(list);
  });

  it('createBrowserCard 应创建并重新加载列表', async () => {
    mockService.createCard.mockResolvedValue(undefined);
    mockService.getCards.mockResolvedValue([]);
    const store = createTestStore();

    await store.getState().createBrowserCard({ name: 'n', url: 'https://n.com' });

    expect(mockService.createCard).toHaveBeenCalledWith({ name: 'n', url: 'https://n.com' });
    expect(mockService.getCards).toHaveBeenCalled();
  });

  it('deleteBrowserCard 删除选中项时应清空选中并关闭编辑器', async () => {
    mockService.deleteCard.mockResolvedValue(undefined);
    mockService.getCards.mockResolvedValue([]);
    const store = createTestStore({ selectedBrowserCardId: '1', showEditor: true });

    await store.getState().deleteBrowserCard('1');

    expect(mockService.deleteCard).toHaveBeenCalledWith('1');
    expect(mockService.getCards).toHaveBeenCalled();
    expect(store.getState().selectedBrowserCardId).toBeNull();
    expect(store.getState().showEditor).toBe(false);
  });

  it('updateBrowserCard 应更新并重新加载列表', async () => {
    mockService.updateCard.mockResolvedValue(undefined);
    mockService.getCards.mockResolvedValue([]);
    const store = createTestStore();

    await store.getState().updateBrowserCard('1', { name: 'new' });

    expect(mockService.updateCard).toHaveBeenCalledWith('1', { name: 'new' });
    expect(mockService.getCards).toHaveBeenCalled();
  });

  it('triggerBrowserCardsRefresh 应自增刷新计数', () => {
    const store = createTestStore();
    store.getState().triggerBrowserCardsRefresh();
    expect(store.getState().refreshBrowserCardsTrigger).toBe(1);
    store.getState().triggerBrowserCardsRefresh();
    expect(store.getState().refreshBrowserCardsTrigger).toBe(2);
  });
});
