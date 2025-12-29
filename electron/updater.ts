import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, type UpdateDownloadedEvent, type ProgressInfo } from 'electron-updater';
import type { UpdateStatusPayload } from '../src/services/types';

const STATUS_CHANNEL = 'updater:status';
let lastStatus: UpdateStatusPayload = { state: app.isPackaged ? 'idle' : 'disabled' };
let isInitialized = false;
let isChecking = false;

const sanitizeReleaseNotes = (notes: UpdateDownloadedEvent['releaseNotes']) => {
  if (Array.isArray(notes)) {
    return notes
      .map((notePart) => {
        if (typeof notePart === 'string') return notePart;
        if (typeof notePart === 'object' && notePart !== null) {
          return notePart.note ?? notePart.version ?? '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (notes && typeof notes === 'object') {
    return (notes as { note?: string }).note ?? null;
  }
  return (notes as string | null | undefined) ?? null;
};

const createStatusSender =
  (getWindow: () => BrowserWindow | null) => (payload: UpdateStatusPayload) => {
    lastStatus = payload;
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(STATUS_CHANNEL, payload);
    }
  };

const sendProgressStatus =
  (sendStatus: (status: UpdateStatusPayload) => void) => (progress: ProgressInfo) => {
    sendStatus({
      state: 'downloading',
      percent: Math.round(progress.percent * 10) / 10,
      transferredBytes: progress.transferred,
      totalBytes: progress.total,
      version: lastStatus.version,
    });
  };

export function initAutoUpdater(getWindow: () => BrowserWindow | null) {
  if (isInitialized) return;
  isInitialized = true;

  const sendStatus = createStatusSender(getWindow);

  ipcMain.handle('updater:last-status', async () => lastStatus);

  if (!app.isPackaged) {
    ipcMain.handle('updater:check-now', async () => ({ skipped: true, reason: 'dev' }));
    ipcMain.handle('updater:install-now', async () => ({ skipped: true, reason: 'dev' }));
    sendStatus({ state: 'disabled' });
    return;
  }

  const customFeedUrl = process.env.INFINITY_UPDATER_URL;
  if (customFeedUrl) {
    try {
      autoUpdater.setFeedURL({ provider: 'generic', url: customFeedUrl });
    } catch (error) {
      sendStatus({
        state: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : '无法设置更新源',
      });
    }
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.fullChangelog = true;

  const checkForUpdates = async () => {
    if (isChecking) {
      return { skipped: true } as const;
    }
    isChecking = true;
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true } as const;
    } catch (error) {
      sendStatus({
        state: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : '检查更新失败',
      });
      return { ok: false } as const;
    } finally {
      isChecking = false;
    }
  };

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ state: 'checking', version: lastStatus.version });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      state: 'available',
      version: info?.version,
      releaseNotes: sanitizeReleaseNotes(info?.releaseNotes),
    });

    autoUpdater.downloadUpdate().catch((error) => {
      sendStatus({
        state: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : '下载更新失败',
      });
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus({ state: 'idle' });
  });

  autoUpdater.on('error', (error) => {
    let errorMessage = error instanceof Error ? error.message : String(error);

    // 针对 macOS 签名校验失败的特殊处理
    if (process.platform === 'darwin' && errorMessage.includes('Code signature')) {
      errorMessage =
        'macOS 系统安全限制：由于应用未经过 Apple 官方签名，无法执行自动覆盖更新。请前往发布页面手动下载最新版安装包直接覆盖安装即可。';
    }

    sendStatus({
      state: 'error',
      errorMessage,
    });
  });

  autoUpdater.on('download-progress', sendProgressStatus(sendStatus));

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({
      state: 'downloaded',
      version: info?.version,
      releaseNotes: sanitizeReleaseNotes(info?.releaseNotes),
    });
  });

  ipcMain.handle('updater:check-now', async () => checkForUpdates());

  ipcMain.handle('updater:install-now', async () => {
    setImmediate(() => {
      autoUpdater.quitAndInstall(true, true);
    });
    return { ok: true } as const;
  });

  const parseInterval = (value: string | undefined, fallback: number) => {
    const parsed = value ? Number(value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const initialDelay = parseInterval(process.env.INFINITY_UPDATER_INITIAL_DELAY_MS, 15_000);
  const interval = parseInterval(process.env.INFINITY_UPDATER_INTERVAL_MS, 6 * 60 * 60 * 1000);

  setTimeout(() => {
    void checkForUpdates();
    setInterval(() => {
      void checkForUpdates();
    }, interval);
  }, initialDelay);
}
