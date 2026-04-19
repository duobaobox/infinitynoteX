import { beforeEach, describe, expect, it, vi } from 'vitest';

type WindowEventHandler = (...args: unknown[]) => void;

const {
  registerRendererWindowMock,
  unregisterRendererWindowMock,
  browserWindowMock,
  webContentsOnMock,
  webContentsSendMock,
  windowOnMock,
  windowOnceMock,
  loadURLMock,
  loadFileMock,
  windowEventHandlers,
} = vi.hoisted(() => {
  const eventHandlers = new Map<string, WindowEventHandler>();

  const fakeBrowserWindow = {
    webContents: {
      on: vi.fn((event: string, handler: WindowEventHandler) => {
        eventHandlers.set(`webContents:${event}`, handler);
      }),
      send: vi.fn(),
    },
    on: vi.fn((event: string, handler: WindowEventHandler) => {
      eventHandlers.set(event, handler);
    }),
    once: vi.fn((event: string, handler: WindowEventHandler) => {
      eventHandlers.set(`once:${event}`, handler);
    }),
    isDestroyed: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
    getSize: vi.fn(() => [700, 560]),
    getPosition: vi.fn(() => [100, 100]),
    show: vi.fn(),
    maximize: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    loadURL: vi.fn(),
    loadFile: vi.fn(),
  };

  return {
    registerRendererWindowMock: vi.fn(),
    unregisterRendererWindowMock: vi.fn(),
    browserWindowMock: vi.fn(() => fakeBrowserWindow),
    webContentsOnMock: fakeBrowserWindow.webContents.on,
    webContentsSendMock: fakeBrowserWindow.webContents.send,
    windowOnMock: fakeBrowserWindow.on,
    windowOnceMock: fakeBrowserWindow.once,
    loadURLMock: fakeBrowserWindow.loadURL,
    loadFileMock: fakeBrowserWindow.loadFile,
    windowEventHandlers: eventHandlers,
  };
});

vi.mock('electron', () => ({
  BrowserWindow: browserWindowMock,
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
}));

vi.mock('../../../../electron/config', () => ({
  readAppConfig: vi.fn(() => ({
    window: {
      width: 700,
      height: 560,
      isMaximized: false,
    },
  })),
  writeAppConfig: vi.fn(),
}));

vi.mock('../../../../electron/ai/toolApprovalStateManager', () => ({
  toolApprovalStateManager: {
    registerRendererWindow: registerRendererWindowMock,
    unregisterRendererWindow: unregisterRendererWindowMock,
  },
}));

import { createMainWindow } from '../../../../electron/windows/mainWindow';

describe('createMainWindow', () => {
  beforeEach(() => {
    registerRendererWindowMock.mockClear();
    unregisterRendererWindowMock.mockClear();
    browserWindowMock.mockClear();
    webContentsOnMock.mockClear();
    webContentsSendMock.mockClear();
    windowOnMock.mockClear();
    windowOnceMock.mockClear();
    loadURLMock.mockClear();
    loadFileMock.mockClear();
    windowEventHandlers.clear();
  });

  it('registers the main renderer window for tool approval state broadcasts', () => {
    const win = createMainWindow();

    expect(browserWindowMock).toHaveBeenCalledTimes(1);
    expect(registerRendererWindowMock).toHaveBeenCalledWith(win);
  });

  it('unregisters the main renderer window when it closes', () => {
    const win = createMainWindow();
    const closedHandler = windowEventHandlers.get('closed');

    expect(closedHandler).toBeTypeOf('function');

    closedHandler?.();

    expect(unregisterRendererWindowMock).toHaveBeenCalledWith(win);
  });
});
