import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UpdateStatusPayload } from '../services/types';

interface UseAutoUpdaterResult {
  status: UpdateStatusPayload | null;
  checking: boolean;
  installing: boolean;
  supportsUpdater: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

const defaultStatus: UpdateStatusPayload = { state: 'disabled' };

export const useAutoUpdater = (): UseAutoUpdaterResult => {
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!window.autoUpdater) return undefined;

    window.autoUpdater
      .getLastStatus()
      .then((snapshot) => setStatus(snapshot ?? defaultStatus))
      .catch((error) => console.warn('[Updater] Failed to fetch last status', error));

    const unsubscribe = window.autoUpdater.onStatusChange((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus.state !== 'checking') {
        setChecking(false);
      }
      if (nextStatus.state !== 'downloaded') {
        setInstalling(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!window.autoUpdater) return;
    setChecking(true);
    try {
      await window.autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[Updater] checkForUpdates failed', error);
      setChecking(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!window.autoUpdater) return;
    setInstalling(true);
    try {
      await window.autoUpdater.installUpdate();
    } catch (error) {
      console.error('[Updater] installUpdate failed', error);
      setInstalling(false);
    }
  }, []);

  return useMemo(
    () => ({
      status,
      checking,
      installing,
      supportsUpdater: Boolean(window.autoUpdater),
      checkForUpdates,
      installUpdate,
    }),
    [status, checking, installing, checkForUpdates, installUpdate],
  );
};
