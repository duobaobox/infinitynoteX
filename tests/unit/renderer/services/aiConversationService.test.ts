/**
 * AIConversationService 测试
 * 验证对 window.storage AI 对话 API 的委托
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiConversationService } from '../../../../src/services/aiConversationService';

const mockStorage = {
  getAIConversations: vi.fn(),
  createAIConversation: vi.fn(),
  deleteAIConversation: vi.fn(),
  updateAIConversationTitle: vi.fn(),
  saveAIConversationMessages: vi.fn(),
};

Object.assign(window, { storage: mockStorage });

describe('aiConversationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getConversations should fetch list', async () => {
    const previews = [{ id: 'c1', title: 'chat', updatedAt: Date.now() }];
    mockStorage.getAIConversations.mockResolvedValue(previews);

    const result = await aiConversationService.getConversations();
    expect(mockStorage.getAIConversations).toHaveBeenCalled();
    expect(result).toEqual(previews);
  });

  it('createConversation should delegate with optional title', async () => {
    mockStorage.createAIConversation.mockResolvedValue(undefined);
    await aiConversationService.createConversation('new chat');
    expect(mockStorage.createAIConversation).toHaveBeenCalledWith('new chat');
  });

  it('deleteConversation should forward id', async () => {
    mockStorage.deleteAIConversation.mockResolvedValue(undefined);
    await aiConversationService.deleteConversation('c1');
    expect(mockStorage.deleteAIConversation).toHaveBeenCalledWith('c1');
  });

  it('updateTitle should forward id and title', async () => {
    mockStorage.updateAIConversationTitle.mockResolvedValue(undefined);
    await aiConversationService.updateTitle('c1', 'renamed');
    expect(mockStorage.updateAIConversationTitle).toHaveBeenCalledWith('c1', 'renamed');
  });

  it('saveMessages should forward payload', async () => {
    const messages = [{ role: 'user', content: 'hi', timestamp: Date.now() }];
    mockStorage.saveAIConversationMessages.mockResolvedValue(undefined);

    await aiConversationService.saveMessages('c1', messages as never);
    expect(mockStorage.saveAIConversationMessages).toHaveBeenCalledWith('c1', messages);
  });
});
