/**
 * FloatingNoteTodoWindow.tsx
 * 便签任务悬浮窗组件 - 专用于显示从便签解析的任务
 *
 * 与 FloatingTodoWindow 的区别：
 * - 数据来源：从所有便签中解析任务，而非 ManualTaskStorage
 * - 无添加功能：便签任务只能在便签中创建，此处只读展示
 * - 支持跳转：点击可跳转到源便签
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Checkbox, Empty, Tooltip } from 'antd';
import dayjs from 'dayjs';
import {
  ClockCircleOutlined,
  FileTextOutlined,
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { BaseFloatingWindow } from '../BaseFloatingWindow';
import type { ParsedTask } from '../../features/todo/types';
import {
  parseTasksFromNotes,
  updateTaskCheckedStatus,
} from '../../features/todo/services/taskParser';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import {
  createNoteSyncPayload,
  onRendererIpc,
  sendRendererIpc,
} from '../../shared/utils/ipcEvents';
import { loadAllNotes } from '../../shared/utils/noteLoader';
import { NOTE_TASKS_LIST_ID } from '../../shared/constants/todoConstants';
import './FloatingNoteTodoWindow.css';

// 日期状态类型
type DueDateStatus = 'overdue' | 'today' | 'tomorrow' | 'future' | 'none';

const FloatingNoteTodoWindow: React.FC = () => {
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取截止日期状态
  const getDueDateStatus = (dueDate?: number): DueDateStatus => {
    if (!dueDate) return 'none';
    const now = dayjs();
    const due = dayjs(dueDate);
    const today = now.startOf('day');
    const tomorrow = today.add(1, 'day');
    const dueDay = due.startOf('day');

    if (due.isBefore(now)) return 'overdue';
    if (dueDay.isSame(today)) return 'today';
    if (dueDay.isSame(tomorrow)) return 'tomorrow';
    return 'future';
  };

  // 格式化显示日期
  const formatDueDate = (dueDate: number, status: DueDateStatus): string => {
    const due = dayjs(dueDate);
    const hasTime = due.hour() !== 0 || due.minute() !== 0;

    switch (status) {
      case 'overdue':
        return hasTime ? `逾期 ${due.format('MM/DD HH:mm')}` : `逾期 ${due.format('MM/DD')}`;
      case 'today':
        return hasTime ? `今天 ${due.format('HH:mm')}` : '今天';
      case 'tomorrow':
        return hasTime ? `明天 ${due.format('HH:mm')}` : '明天';
      default:
        return hasTime ? due.format('MM/DD HH:mm') : due.format('MM/DD');
    }
  };

  // 加载便签任务
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const allNotes = await loadAllNotes();

      // 解析所有任务
      const parsedTasks = parseTasksFromNotes(allNotes);
      setTasks(parsedTasks);
    } catch (error) {
      console.error('Failed to load note tasks:', error);
      if (!silent) message.error('加载失败');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听便签变化，同步刷新
  useEffect(() => {
    const handleNoteUpdate = async () => {
      // 收到更新事件时，使用静默刷新，避免闪烁
      await loadData(true);
    };

    const offNoteUpdated = onRendererIpc(IPC_CHANNELS.noteUpdated, handleNoteUpdate);
    const offFloatingNoteUpdated = onRendererIpc(
      IPC_CHANNELS.floatingNoteUpdated,
      handleNoteUpdate,
    );
    // 监听主页面的便签任务勾选操作
    const offTodoUpdated = onRendererIpc(IPC_CHANNELS.todoUpdated, handleNoteUpdate);

    return () => {
      offNoteUpdated();
      offFloatingNoteUpdated();
      offTodoUpdated();
    };
  }, [loadData]);

  // 切换任务勾选状态
  const handleToggleTask = async (task: ParsedTask) => {
    try {
      // 1. 乐观更新：立即更新本地状态，提供即时反馈
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === task.id ? { ...t, checked: !t.checked } : t)),
      );

      // 2. 获取便签
      const note = await window.storage.getNote(task.noteId);
      if (!note) return;

      // 3. 更新任务状态
      const newContent = updateTaskCheckedStatus(note.content, task.path, !task.checked);

      // 4. 保存便签
      await window.storage.updateNote(task.noteId, { content: newContent });

      // 5. 通知其他窗口（便签窗口 + Todo 窗口）
      sendRendererIpc(IPC_CHANNELS.noteChanged, createNoteSyncPayload(task.noteId));
      // 同时通知 Todo 窗口（确保药丸和主页面也能同步）
      sendRendererIpc(IPC_CHANNELS.todoChanged, NOTE_TASKS_LIST_ID);

      // 注意：这里不需要手动调用 loadData()，因为事件会触发上方监听的 reload
      // 即使不触发，本地状态已经更新了，用户体验是流畅的
    } catch (error) {
      console.error('Failed to toggle task:', error);
      message.error('操作失败');
      // 失败回滚：重新加载真实数据
      await loadData(true);
    }
  };

  // 跳转到源便签
  const handleGoToSource = (task: ParsedTask) => {
    // 通过 IPC 通知主窗口跳转
    sendRendererIpc(IPC_CHANNELS.navigateNote, {
      folderId: task.folderId,
      noteId: task.noteId,
      taskPath: task.path,
    });
  };

  const handleClose = () => {
    window.floatingTodo?.closeWindow(NOTE_TASKS_LIST_ID);
  };

  const handleMinimize = async () => {
    await window.floatingTodo?.minimizeWindow(NOTE_TASKS_LIST_ID);
  };

  // 筛选和统计
  const pendingTasks = useMemo(() => tasks.filter((t) => !t.checked), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.checked), [tasks]);

  // 排序：待办优先，按截止日期排序
  const sortedTasks = useMemo(() => {
    return [...pendingTasks, ...completedTasks].sort((a, b) => {
      // 未完成的排在前面
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      // 按截止日期排序
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      // 按更新时间
      return b.updatedAt - a.updatedAt;
    });
  }, [pendingTasks, completedTasks]);

  if (isLoading) {
    return null;
  }

  const footer = (
    <div className="floating-note-todo-footer">
      <span>待办 {pendingTasks.length}</span>
      <span className="floating-note-todo-footer-divider">·</span>
      <span>完成 {completedTasks.length}</span>
    </div>
  );

  return (
    <BaseFloatingWindow
      title="便签任务"
      // headerColor="linear-gradient..." // 使用 CSS 控制
      titleColor="#ffffff"
      onClose={handleClose}
      onMinimize={handleMinimize}
      footer={footer}
      className="floating-note-todo-window"
    >
      {/* 提示信息 */}
      <div className="floating-note-todo-hint">
        <InfoCircleOutlined style={{ fontSize: 13 }} />
        任务来自便签，在便签中使用「任务列表」添加
      </div>

      {/* 任务列表 */}
      <div className="floating-note-todo-list custom-scrollbar">
        {sortedTasks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="便签中暂无任务"
            style={{ marginTop: 40 }}
          />
        ) : (
          sortedTasks.map((task) => {
            const status = getDueDateStatus(task.dueDate);
            return (
              <div
                key={task.id}
                className={`floating-note-todo-item ${task.checked ? 'checked' : ''}`}
              >
                <Checkbox checked={task.checked} onChange={() => handleToggleTask(task)} />
                <div className="floating-note-todo-item-content">
                  <span className="floating-note-todo-item-text" title={task.text}>
                    {task.text}
                  </span>
                  <div className="floating-note-todo-item-meta">
                    <Tooltip title={`来自：${task.noteTitle}`}>
                      <span
                        className="floating-note-todo-item-source"
                        onClick={() => handleGoToSource(task)}
                      >
                        <FileTextOutlined style={{ marginRight: 2 }} />
                        {task.noteTitle.length > 8
                          ? task.noteTitle.slice(0, 8) + '...'
                          : task.noteTitle}
                        <LinkOutlined style={{ marginLeft: 2, fontSize: 10 }} />
                      </span>
                    </Tooltip>
                    {task.dueDate && status !== 'none' && (
                      <span className={`floating-note-todo-due-tag ${status}`}>
                        <ClockCircleOutlined style={{ marginRight: 2 }} />
                        {formatDueDate(task.dueDate, status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </BaseFloatingWindow>
  );
};

export default FloatingNoteTodoWindow;
