/**
 * useNoteSave - 便签保存逻辑 Hook
 *
 * 保存机制：
 * 1. 编辑时防抖保存（1.5秒延迟）
 * 2. 切换便签时立即保存当前内容
 * 3. 页面关闭/刷新时保存
 * 4. 脏数据追踪，避免重复保存
 */

import { useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import type { PendingSave } from '../types';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';

interface UseNoteSaveReturn {
  /** 待保存数据引用 */
  pendingSaveRef: React.MutableRefObject<PendingSave | null>;

  /** 立即保存 */
  saveImmediately: (data?: PendingSave, silent?: boolean) => Promise<boolean>;
  /** 防抖保存 */
  debouncedSave: (noteId: string, title: string, content: PendingSave['content']) => void;
  /** 强制保存待处理内容 */
  flushPendingSave: () => Promise<void>;
}

export const useNoteSave = (): UseNoteSaveReturn => {
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);

  // 保存相关的 refs
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<PendingSave | null>(null);
  const isSavingRef = useRef<boolean>(false);

  /**
   * 立即执行保存（核心保存函数）
   */
  const saveImmediately = useCallback(
    async (data?: PendingSave, silent = false): Promise<boolean> => {
      const saveData = data || pendingSaveRef.current;

      if (!saveData || !saveData.noteId) {
        return false;
      }

      // 防止并发保存
      if (isSavingRef.current) {
        return false;
      }

      isSavingRef.current = true;

      try {
        await window.storage.updateNote(saveData.noteId, {
          title: saveData.title,
          content: saveData.content,
        });

        // 清除待保存数据
        if (pendingSaveRef.current?.noteId === saveData.noteId) {
          pendingSaveRef.current = null;
        }

        // 通知其他窗口（便签窗口）
        window.ipcRenderer?.send('note:changed', saveData.noteId);
        // 同时通知 Todo 窗口（确保任务勾选能同步更新）
        window.ipcRenderer?.send('todo:changed', 'default-note-tasks');
        triggerListRefresh();

        return true;
      } catch (error) {
        console.error('Failed to save note:', error);
        if (!silent) {
          message.error('保存失败，请检查磁盘空间');
        }
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [triggerListRefresh],
  );

  /**
   * 防抖保存 - 编辑过程中使用
   */
  const debouncedSave = useCallback(
    (noteId: string, title: string, content: PendingSave['content']) => {
      pendingSaveRef.current = { noteId, title, content };

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveImmediately();
      }, 1500);
    },
    [saveImmediately],
  );

  /**
   * 强制保存当前内容
   */
  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (pendingSaveRef.current) {
      await saveImmediately(pendingSaveRef.current, true);
    }
  }, [saveImmediately]);

  /**
   * 监听生命周期，确保数据不丢失
   */
  // 页面关闭/刷新时保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        const data = pendingSaveRef.current;

        // 使用同步 IPC 确保数据在进程终止前发送到主进程
        try {
          const success = window.storage.updateNoteSync(data.noteId, {
            title: data.title,
            content: data.content,
          });

          if (!success) {
            console.error('Failed to sync save on unload');
          }
        } catch (e) {
          console.error('Error during sync save on unload:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 组件卸载时保存
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingSaveRef.current) {
        const data = pendingSaveRef.current;
        // 这里的 ref.current 在 unmount cleanup 时依然有效
        window.storage
          .updateNote(data.noteId, {
            title: data.title,
            content: data.content,
          })
          .catch((e) => console.error('Failed to save on unmount:', e));
      }
    };
  }, []);

  return {
    saveImmediately,
    debouncedSave,
    flushPendingSave,
    // 依然暴露 ref 以备不时之需，但建议尽量少用
    pendingSaveRef,
  };
};
