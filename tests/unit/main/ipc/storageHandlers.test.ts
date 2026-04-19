import { beforeEach, describe, expect, it, vi } from 'vitest';

type UnknownHandler = (...args: unknown[]) => unknown;

const {
  registeredHandlers,
  handleMock,
  saveMessagesMock,
  updateTitleMock,
  emitCreatedMock,
  emitDeletedMock,
  emitUpdatedMock,
} = vi.hoisted(() => {
  const handlers = new Map<string, UnknownHandler>();

  return {
    registeredHandlers: handlers,
    handleMock: vi.fn((channel: string, handler: UnknownHandler) => {
      handlers.set(channel, handler);
    }),
    saveMessagesMock: vi.fn(async () => ({ id: 'conv-1' })),
    updateTitleMock: vi.fn(async () => ({ id: 'conv-1', title: '新标题' })),
    emitCreatedMock: vi.fn(),
    emitDeletedMock: vi.fn(),
    emitUpdatedMock: vi.fn(),
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('../../../../electron/storage', () => ({
  storageManager: {
    ai: {
      saveMessages: saveMessagesMock,
      updateTitle: updateTitleMock,
    },
  },
}));

vi.mock('../../../../electron/storage/storageEvents', () => ({
  emitCreated: emitCreatedMock,
  emitDeleted: emitDeletedMock,
  emitUpdated: emitUpdatedMock,
}));

import { registerStorageHandlers } from '../../../../electron/ipc/storageHandlers';
import { getIpcProxyChannel } from '../../../../src/shared/types/ipc';

describe('registerStorageHandlers', () => {
  beforeEach(() => {
    registeredHandlers.clear();
    handleMock.mockClear();
    saveMessagesMock.mockClear();
    updateTitleMock.mockClear();
    emitCreatedMock.mockClear();
    emitDeletedMock.mockClear();
    emitUpdatedMock.mockClear();

    registerStorageHandlers();
  });

  it('emits updated event after saving AI conversation messages', async () => {
    const handler = registeredHandlers.get(
      getIpcProxyChannel('storage', 'saveAIConversationMessages'),
    );

    expect(handler).toBeTypeOf('function');

    await handler?.({}, 'conv-1', [{ role: 'user', content: 'hello', timestamp: 1 }], undefined);

    expect(saveMessagesMock).toHaveBeenCalledWith(
      'conv-1',
      [{ role: 'user', content: 'hello', timestamp: 1 }],
      undefined,
    );
    expect(emitUpdatedMock).toHaveBeenCalledWith('aiConversation', 'conv-1');
  });

  it('emits updated event after updating AI conversation title', async () => {
    const handler = registeredHandlers.get(
      getIpcProxyChannel('storage', 'updateAIConversationTitle'),
    );

    expect(handler).toBeTypeOf('function');

    await handler?.({}, 'conv-1', '新标题');

    expect(updateTitleMock).toHaveBeenCalledWith('conv-1', '新标题');
    expect(emitUpdatedMock).toHaveBeenCalledWith('aiConversation', 'conv-1');
  });
});
