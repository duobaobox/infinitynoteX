/**
 * TodoPillWindow.tsx
 * Todo 药丸窗口组件 - 使用 BasePillWindow 基础组件
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BasePillWindow } from '../BasePillWindow';
import type { TodoList, ManualTaskIndex } from '../../services/types';
import { DEFAULT_TODO_LIST_ID } from '../../features/todo/types';
import { parseTasksFromNotes } from '../../features/todo/services/taskParser';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { onRendererIpc } from '../../shared/utils/ipcEvents';
import { loadAllNotes } from '../../shared/utils/noteLoader';
import './TodoPillWindow.css';

// Todo 装饰图标
const TodoIcon: React.FC = () => (
  <div className="pill-todo-icon">
    <div className="pill-todo-icon__card">
      <div className="pill-todo-icon__shine" />
      <div className="pill-todo-icon__checks" />
    </div>
  </div>
);

interface TodoPillWindowProps {
  listId: string;
}

const TodoPillWindow: React.FC<TodoPillWindowProps> = ({ listId }) => {
  const [list, setList] = useState<TodoList | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setIsLoading(true);

        // 1. 获取列表信息
        const lists = await window.storage.listTodoLists();
        const currentList = lists.find((l) => l.id === listId);
        if (currentList) {
          setList(currentList);
        }

        // 2. 获取任务数量
        let pending = 0;
        if (listId === DEFAULT_TODO_LIST_ID) {
          // 便签任务：需要解析所有便签
          const allNotes = await loadAllNotes();
          const parsedTasks = parseTasksFromNotes(allNotes);
          pending = parsedTasks.filter((t) => !t.checked).length;
        } else {
          // 自定义清单：直接读取存储
          const tasks = await window.storage.listManualTasks(listId);
          pending = tasks.filter((t: ManualTaskIndex) => !t.checked).length;
        }

        setPendingCount(pending);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load todo info:', error);
        setIsLoading(false);
      }
    },
    [listId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleUpdate = async (_event: unknown, updatedId?: string) => {
      // 如果是便签任务相关，无论 ID 是什么都静默刷新 (便签更新事件不带清单 ID)
      if (listId === DEFAULT_TODO_LIST_ID) {
        await loadData(true);
      } else if (updatedId === listId) {
        await loadData(true);
      }
    };

    const offTodoUpdated = onRendererIpc(IPC_CHANNELS.todoUpdated, handleUpdate);

    // 如果是便签任务，还需要监听便签更新
    let offNoteUpdated: (() => void) | null = null;
    if (listId === DEFAULT_TODO_LIST_ID) {
      offNoteUpdated = onRendererIpc(IPC_CHANNELS.noteUpdated, handleUpdate);
    }

    return () => {
      offTodoUpdated();
      offNoteUpdated?.();
    };
  }, [listId, loadData]);

  const handleRestore = async () => {
    await window.floatingTodo?.restoreWindow(listId);
  };

  const bgColor = list?.color || (listId === DEFAULT_TODO_LIST_ID ? '#ffe7ba' : '#b5f5ec');

  if (isLoading) {
    return (
      <BasePillWindow
        title="加载中..."
        bgColor={bgColor}
        textColor="#ffffff"
        icon={<TodoIcon />}
        onRestore={handleRestore}
        className="todo-pill-window"
      />
    );
  }

  return (
    <BasePillWindow
      title={`待办 ${pendingCount}`}
      bgColor={bgColor}
      textColor="#ffffff"
      icon={<TodoIcon />}
      onRestore={handleRestore}
      className="todo-pill-window"
      tooltip={list?.name || '清单'}
    />
  );
};

export default TodoPillWindow;
