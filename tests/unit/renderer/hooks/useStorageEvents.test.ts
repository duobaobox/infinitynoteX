/**
 * useStorageEvents 测试
 * 覆盖订阅、删除/创建/更新事件处理以及卸载时的清理
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useStorageEvents, type StorageEvent } from '../../../../src/hooks/useStorageEvents';
import { resolveAIWorkbenchSelection } from '../../../../src/features/ai-workbench/model/workbenchConversationItems';

// Mock workspace store selector调用行为
const mockState = {
  selectedNoteId: 'note-1',
  selectedFolderId: 'folder-1',
  selectedToolItemId: 'conv-1',
  selectedAIWorkbenchItem: resolveAIWorkbenchSelection('conv-1', [
    {
      id: 'conv-1',
      title: '对话',
      excerpt: '测试',
      createdAt: 1,
      updatedAt: 2,
      source: 'workbench' as const,
    },
  ]),
  setSelectedNote: vi.fn(),
  setSelectedFolder: vi.fn(),
  setSelectedToolItem: vi.fn(),
  setSelectedAIWorkbenchItem: vi.fn(),
  loadNotes: vi.fn(),
  loadFolders: vi.fn(),
  loadAIConversations: vi.fn(),
  triggerListRefresh: vi.fn(),
  triggerAIConversationsRefresh: vi.fn(),
};

vi.mock('../../../../src/store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector: (state: typeof mockState) => unknown) => selector(mockState),
    {
      getState: () => mockState,
    },
  ),
}));

describe('useStorageEvents', () => {
  let handler: ((e: StorageEvent) => void) | undefined;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    Object.values(mockState).forEach((v) => typeof v === 'function' && v.mockClear());
    handler = undefined;
    unsubscribe.mockClear();

    Object.assign(window, {
      storageEvents: {
        onEvent: vi.fn((fn: (e: StorageEvent) => void) => {
          handler = fn;
          return unsubscribe;
        }),
      },
    });
  });

  const fire = (event: StorageEvent) => {
    if (!handler) throw new Error('handler not registered');
    act(() => {
      handler?.(event);
    });
  };

  it('should subscribe on mount and unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useStorageEvents());

    expect(window.storageEvents.onEvent).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should clear selected note and refresh list on note delete', () => {
    renderHook(() => useStorageEvents());
    fire({ type: 'deleted', entity: 'note', id: 'note-1' });

    expect(mockState.setSelectedNote).toHaveBeenCalledWith(null);
    expect(mockState.triggerListRefresh).toHaveBeenCalled();
  });

  it('should clear selected folder on folder delete and reload folders', () => {
    renderHook(() => useStorageEvents());
    fire({ type: 'deleted', entity: 'folder', id: 'folder-1' });

    expect(mockState.setSelectedFolder).toHaveBeenCalledWith(null);
    expect(mockState.loadFolders).toHaveBeenCalled();
  });

  it('should clear selected conversation on delete and refresh list', () => {
    renderHook(() => useStorageEvents());
    fire({ type: 'deleted', entity: 'aiConversation', id: 'conv-1' });

    expect(mockState.setSelectedAIWorkbenchItem).toHaveBeenCalledWith(null);
    expect(mockState.triggerAIConversationsRefresh).toHaveBeenCalled();
  });

  it('should load notes for current folder on note create', () => {
    renderHook(() => useStorageEvents());
    fire({ type: 'created', entity: 'note', id: 'note-2' });

    expect(mockState.loadNotes).toHaveBeenCalledWith('folder-1');
  });

  it('should refresh conversations on create', () => {
    renderHook(() => useStorageEvents());
    fire({ type: 'created', entity: 'aiConversation', id: 'conv-2' });

    expect(mockState.loadAIConversations).toHaveBeenCalled();
  });

  it('should trigger refresh on update events', () => {
    renderHook(() => useStorageEvents());
    fire({ type: 'updated', entity: 'note', id: 'note-3' });
    fire({ type: 'updated', entity: 'aiConversation', id: 'conv-3' });

    expect(mockState.triggerListRefresh).toHaveBeenCalled();
    expect(mockState.triggerAIConversationsRefresh).toHaveBeenCalled();
  });
});
