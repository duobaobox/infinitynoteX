/**
 * FloatingTodoWindow.tsx
 * 悬浮 Todo 窗口组件 - 使用 BaseFloatingWindow 基础组件
 *
 * 设计理念：保持轻量简洁，专注于快速任务管理
 * - 快速添加任务（不支持设置截止日期，需在主应用中设置）
 * - 显示已有任务的截止日期
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { message, Input, Checkbox, Button, Empty, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { BaseFloatingWindow } from '../BaseFloatingWindow';
import type { ManualTaskIndex, TodoList } from '../../services/types';
import './FloatingTodoWindow.css';

interface FloatingTodoWindowProps {
  listId: string;
}

const FloatingTodoWindow: React.FC<FloatingTodoWindowProps> = ({ listId }) => {
  const [list, setList] = useState<TodoList | null>(null);
  const [tasks, setTasks] = useState<ManualTaskIndex[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 编辑状态
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 加载清单信息和任务
  const loadData = useCallback(async () => {
    try {
      const lists = await window.storage.listTodoLists();
      const currentList = lists.find((l) => l.id === listId);
      if (currentList) {
        setList(currentList);
      }
      const taskList = await window.storage.listManualTasks(listId);
      setTasks(taskList.sort((a, b) => a.order - b.order));
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load todo data:', error);
      message.error('加载失败');
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

  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTaskId]);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    try {
      // 悬浮窗口不支持设置截止日期，保持简洁
      await window.storage.createManualTask(listId, newTaskText.trim());
      setNewTaskText('');
      await loadData();
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('Failed to create task:', error);
      message.error('添加失败');
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await window.storage.toggleManualTask(taskId, listId);
      await loadData();
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('Failed to toggle task:', error);
      message.error('操作失败');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await window.storage.deleteManualTask(taskId, listId);
      await loadData();
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('Failed to delete task:', error);
      message.error('删除失败');
    }
  };

  const handleStartEdit = (task: ManualTaskIndex) => {
    setEditingTaskId(task.id);
    setEditTaskText(task.text);
  };

  const handleSaveEdit = async () => {
    if (!editingTaskId || !editTaskText.trim()) {
      setEditingTaskId(null);
      return;
    }
    try {
      await window.storage.updateManualTask(editingTaskId, listId, {
        text: editTaskText.trim(),
      });
      setEditingTaskId(null);
      await loadData();
      window.ipcRenderer?.send('todo:changed', listId);
    } catch (error) {
      console.error('Failed to update task:', error);
      message.error('保存失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditTaskText('');
  };

  const handleClose = () => {
    window.floatingTodo?.closeWindow(listId);
  };

  const handleMinimize = async () => {
    await window.floatingTodo?.minimizeWindow(listId);
  };

  const pendingCount = tasks.filter((t) => !t.checked).length;
  const completedCount = tasks.filter((t) => t.checked).length;

  if (isLoading) {
    return null;
  }

  const headerBgColor = list?.color || '#52c41a';

  const footer = (
    <div className="floating-todo-footer">
      <span>待办 {pendingCount}</span>
      <span className="floating-todo-footer-divider">·</span>
      <span>完成 {completedCount}</span>
    </div>
  );

  return (
    <BaseFloatingWindow
      title={list?.name || '任务清单'}
      headerColor={headerBgColor}
      titleColor="#ffffff"
      onClose={handleClose}
      onMinimize={handleMinimize}
      footer={footer}
      className="floating-todo-window"
    >
      {/* 添加任务输入框 - 简洁版，不含日期选择 */}
      <div className="floating-todo-add">
        <Input
          placeholder="添加新任务..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onPressEnter={handleAddTask}
          prefix={<PlusOutlined style={{ color: '#bfbfbf' }} />}
          suffix={
            newTaskText.trim() && (
              <Button type="link" size="small" onClick={handleAddTask}>
                添加
              </Button>
            )
          }
        />
      </div>

      {/* 任务列表 */}
      <div className="floating-todo-list">
        {tasks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无任务"
            style={{ marginTop: 40 }}
          />
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={`floating-todo-item ${task.checked ? 'checked' : ''}`}>
              <Checkbox checked={task.checked} onChange={() => handleToggleTask(task.id)} />
              {editingTaskId === task.id ? (
                <input
                  ref={editInputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  className="floating-todo-item-edit"
                  value={editTaskText}
                  onChange={(e) => setEditTaskText(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
              ) : (
                <div className="floating-todo-item-content">
                  <span
                    className="floating-todo-item-text"
                    onDoubleClick={() => handleStartEdit(task)}
                    title="双击编辑"
                  >
                    {task.text}
                  </span>
                  {task.dueDate && (
                    <span className="floating-todo-item-due">
                      <ClockCircleOutlined style={{ marginRight: 4, fontSize: 10 }} />
                      {dayjs(task.dueDate).format('MM/DD HH:mm')}
                    </span>
                  )}
                </div>
              )}
              <Popconfirm
                title="删除任务"
                description="确定删除？"
                onConfirm={() => handleDeleteTask(task.id)}
                okText="删除"
                cancelText="取消"
                placement="left"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  className="floating-todo-item-delete"
                />
              </Popconfirm>
            </div>
          ))
        )}
      </div>
    </BaseFloatingWindow>
  );
};

export default FloatingTodoWindow;
