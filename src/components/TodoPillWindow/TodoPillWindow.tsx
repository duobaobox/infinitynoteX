/**
 * TodoPillWindow.tsx
 * Todo 药丸窗口组件 - 使用 BasePillWindow 基础组件
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BasePillWindow } from '../BasePillWindow';
import type { TodoList, ManualTaskIndex } from '../../services/types';
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

  const loadData = useCallback(async () => {
    try {
      const lists = await window.storage.listTodoLists();
      const currentList = lists.find((l) => l.id === listId);
      if (currentList) {
        setList(currentList);
      }
      const tasks = await window.storage.listManualTasks(listId);
      const pending = tasks.filter((t: ManualTaskIndex) => !t.checked).length;
      setPendingCount(pending);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load todo info:', error);
      setIsLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleTodoUpdate = async (_event: unknown, updatedListId: string) => {
      if (updatedListId === listId) {
        await loadData();
      }
    };
    window.ipcRenderer?.on('todo:updated', handleTodoUpdate);
    return () => {
      window.ipcRenderer?.off('todo:updated', handleTodoUpdate);
    };
  }, [listId, loadData]);

  const handleRestore = async () => {
    await window.floatingTodo?.restoreWindow(listId);
  };

  const bgColor = list?.color || '#52c41a';

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
