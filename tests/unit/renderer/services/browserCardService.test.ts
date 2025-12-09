/**
 * BrowserCardService 测试
 * 验证对 window.browserCards API 的委托
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { browserCardService } from '../../../../src/services/browserCardService';

const mockBrowserCards = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
};

Object.assign(window, { browserCards: mockBrowserCards });

describe('browserCardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCards should list cards', async () => {
    const cards = [
      { id: '1', name: 'a', url: 'https://a.com', order: 0, createdAt: 1, updatedAt: 1 },
    ];
    mockBrowserCards.list.mockResolvedValue(cards);

    const result = await browserCardService.getCards();
    expect(mockBrowserCards.list).toHaveBeenCalled();
    expect(result).toEqual(cards);
  });

  it('createCard should forward payload', async () => {
    const payload = { name: 'b', url: 'https://b.com' };
    mockBrowserCards.create.mockResolvedValue({
      id: '2',
      order: 1,
      createdAt: 1,
      updatedAt: 1,
      ...payload,
    });

    const result = await browserCardService.createCard(payload);
    expect(mockBrowserCards.create).toHaveBeenCalledWith(payload);
    expect(result.name).toBe('b');
  });

  it('updateCard should forward id and patch', async () => {
    mockBrowserCards.update.mockResolvedValue({
      id: '1',
      name: 'c',
      url: 'https://a.com',
      order: 0,
      createdAt: 1,
      updatedAt: 2,
    });

    const result = await browserCardService.updateCard('1', { name: 'c' });
    expect(mockBrowserCards.update).toHaveBeenCalledWith('1', { name: 'c' });
    expect(result.name).toBe('c');
  });

  it('deleteCard should forward id', async () => {
    mockBrowserCards.delete.mockResolvedValue(undefined);
    await browserCardService.deleteCard('1');
    expect(mockBrowserCards.delete).toHaveBeenCalledWith('1');
  });

  it('reorderCards should forward ordered ids', async () => {
    mockBrowserCards.reorder.mockResolvedValue(undefined);
    await browserCardService.reorderCards(['2', '1']);
    expect(mockBrowserCards.reorder).toHaveBeenCalledWith(['2', '1']);
  });
});
