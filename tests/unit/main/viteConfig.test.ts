/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import config from '../../../vite.config';
import { IPC_CHANNELS } from '../../../src/shared/types/ipc';

type AutoUpdaterHandler = (payload?: unknown) => void;

const { autoUpdaterMock, ipcHandleMock, webContentsSendMock, updaterHandlers } = vi.hoisted(() => {
  const handlers = new Map<string, AutoUpdaterHandler>();

  return {
    updaterHandlers: handlers,
    webContentsSendMock: vi.fn(),
    ipcHandleMock: vi.fn(),
    autoUpdaterMock: {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      fullChangelog: false,
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn(async () => undefined),
      downloadUpdate: vi.fn(async () => undefined),
      quitAndInstall: vi.fn(),
      on: vi.fn((event: string, handler: AutoUpdaterHandler) => {
        handlers.set(event, handler);
      }),
    },
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
  },
  BrowserWindow: vi.fn(),
  ipcMain: {
    handle: ipcHandleMock,
  },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: autoUpdaterMock,
}));

const importUpdater = async () => {
  vi.resetModules();
  return await import('../../../electron/updater');
};

const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
  });
};

describe('vite dev server config', () => {
  it('uses a strict port so Electron does not point to a stale dev server URL', () => {
    expect(config.server).toMatchObject({
      port: 1997,
      strictPort: true,
    });
  });
});

describe('auto updater', () => {
  const originalPlatform = process.platform;
  const originalMacAutoUpdate = process.env.INFINITY_MAC_AUTO_UPDATE;

  beforeEach(() => {
    vi.clearAllMocks();
    updaterHandlers.clear();
    setPlatform(originalPlatform);
    if (originalMacAutoUpdate === undefined) {
      delete process.env.INFINITY_MAC_AUTO_UPDATE;
    } else {
      process.env.INFINITY_MAC_AUTO_UPDATE = originalMacAutoUpdate;
    }
  });

  it('keeps unsigned macOS updates manual and does not download automatically', async () => {
    setPlatform('darwin');
    delete process.env.INFINITY_MAC_AUTO_UPDATE;
    const { initAutoUpdater } = await importUpdater();

    initAutoUpdater(
      () =>
        ({
          isDestroyed: () => false,
          webContents: { send: webContentsSendMock },
        }) as never,
    );

    updaterHandlers.get('update-available')?.({
      version: '1.2.1',
      releaseNotes: 'Release notes',
    });

    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(webContentsSendMock).toHaveBeenCalledWith(
      IPC_CHANNELS.updaterStatus,
      expect.objectContaining({
        state: 'available',
        version: '1.2.1',
        canInstallAutomatically: false,
        manualDownloadUrl: 'https://github.com/duobaobox/infinitynotex/releases/tag/v1.2.1',
      }),
    );
  });

  it('downloads updates automatically on Windows', async () => {
    setPlatform('win32');
    const { initAutoUpdater } = await importUpdater();

    initAutoUpdater(
      () =>
        ({
          isDestroyed: () => false,
          webContents: { send: webContentsSendMock },
        }) as never,
    );

    updaterHandlers.get('update-available')?.({
      version: '1.2.1',
      releaseNotes: 'Release notes',
    });

    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(webContentsSendMock).toHaveBeenCalledWith(
      IPC_CHANNELS.updaterStatus,
      expect.objectContaining({
        state: 'available',
        version: '1.2.1',
        canInstallAutomatically: true,
      }),
    );
  });
});
