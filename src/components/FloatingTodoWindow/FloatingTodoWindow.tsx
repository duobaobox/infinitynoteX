/**
 * FloatingTodoWindow.tsx
 * 悬浮 Todo 窗口组件 - 使用 BaseFloatingWindow 基础组件
 *
 * 设计方案：内嵌日期时间选择器（方案二）
 * - 迷你日历组件
 * - 时间选择器（15分钟间隔）
 * - 快捷日期按钮
 * - 彩色截止日期标签
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { message, Input, Checkbox, Button, Empty, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  DeleteOutlined,
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  CloseCircleFilled,
} from '@ant-design/icons';
import { BaseFloatingWindow } from '../BaseFloatingWindow';
import type { ManualTaskIndex, TodoList } from '../../services/types';
import './FloatingTodoWindow.css';

interface FloatingTodoWindowProps {
  listId: string;
}

// 日期状态类型
type DueDateStatus = 'overdue' | 'today' | 'tomorrow' | 'future' | 'none';

const FloatingTodoWindow: React.FC<FloatingTodoWindowProps> = ({ listId }) => {
  const [list, setList] = useState<TodoList | null>(null);
  const [tasks, setTasks] = useState<ManualTaskIndex[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 日期时间选择状态
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(dayjs());

  // 编辑状态
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // 生成日历网格数据
  const calendarDays = useMemo(() => {
    const startOfMonth = calendarMonth.startOf('month');
    const endOfMonth = calendarMonth.endOf('month');
    const startDayOfWeek = startOfMonth.day();
    const daysInMonth = endOfMonth.date();

    const days: (number | null)[] = [];

    // 填充月初空白
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  }, [calendarMonth]);

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

  // 获取最终的截止日期时间戳
  const getFinalDueDate = (): number | undefined => {
    if (!selectedDate) return undefined;
    return selectedDate.hour(selectedHour).minute(selectedMinute).second(0).valueOf();
  };

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    try {
      const dueDate = getFinalDueDate();
      await window.storage.createManualTask(listId, newTaskText.trim(), dueDate);
      setNewTaskText('');
      setSelectedDate(null);
      setShowDatePanel(false);
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

  // 快捷日期设置

  // 选择日历中的某一天
  const handleSelectDay = (day: number) => {
    const newDate = calendarMonth.date(day);
    setSelectedDate(newDate);
  };

  // 清除日期
  const handleClearDate = () => {
    setSelectedDate(null);
  };

  // 判断日期是否被选中
  const isDateSelected = (day: number): boolean => {
    if (!selectedDate) return false;
    return (
      selectedDate.date() === day &&
      selectedDate.month() === calendarMonth.month() &&
      selectedDate.year() === calendarMonth.year()
    );
  };

  // 判断是否是今天
  const isToday = (day: number): boolean => {
    const today = dayjs();
    return (
      today.date() === day &&
      today.month() === calendarMonth.month() &&
      today.year() === calendarMonth.year()
    );
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
      {/* 添加任务区域 */}
      <div className="floating-todo-add">
        {/* 输入行 */}
        <div className="floating-todo-input-row">
          <Input
            placeholder="添加新任务..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onPressEnter={handleAddTask}
            prefix={<PlusOutlined style={{ color: '#bfbfbf' }} />}
            className="floating-todo-input"
          />
          <Button
            type="text"
            size="small"
            icon={<CalendarOutlined />}
            onClick={() => setShowDatePanel(!showDatePanel)}
            className={`floating-todo-calendar-btn ${selectedDate ? 'has-date' : ''} ${showDatePanel ? 'active' : ''}`}
            title="设置截止日期"
          />
          <Button
            type="primary"
            size="small"
            onClick={handleAddTask}
            disabled={!newTaskText.trim()}
            className="floating-todo-add-btn"
          >
            添加
          </Button>
        </div>

        {/* 内嵌日期时间选择面板 */}
        {showDatePanel && (
          <div className="floating-todo-date-panel">
            {/* 月份导航 */}
            <div className="floating-todo-month-nav">
              <Button
                type="text"
                size="small"
                icon={<LeftOutlined />}
                onClick={() => setCalendarMonth(calendarMonth.subtract(1, 'month'))}
              />
              <span className="floating-todo-month-label">{calendarMonth.format('YYYY年M月')}</span>
              <Button
                type="text"
                size="small"
                icon={<RightOutlined />}
                onClick={() => setCalendarMonth(calendarMonth.add(1, 'month'))}
              />
              {selectedDate && (
                <Button
                  type="text"
                  size="small"
                  icon={<CloseCircleFilled />}
                  onClick={handleClearDate}
                  className="floating-todo-clear-date-btn"
                  title="清除日期"
                />
              )}
            </div>

            {/* 迷你日历 */}
            <div className="floating-todo-mini-calendar">
              <div className="floating-todo-calendar-weekdays">
                {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
                  <span key={d} className="floating-todo-weekday">
                    {d}
                  </span>
                ))}
              </div>
              <div className="floating-todo-calendar-days">
                {calendarDays.map((day, index) => (
                  <span
                    key={index}
                    className={`floating-todo-calendar-day ${day === null ? 'empty' : ''} ${day && isDateSelected(day) ? 'selected' : ''} ${day && isToday(day) ? 'today' : ''}`}
                    onClick={() => day && handleSelectDay(day)}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>

            {/* 时间选择 - 单独一行 */}
            <div className="floating-todo-time-row">
              <span className="floating-todo-time-label">时间</span>
              <div className="floating-todo-time-select">
                <select
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                  className="floating-todo-time-dropdown"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="floating-todo-time-separator">:</span>
                <select
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                  className="floating-todo-time-dropdown"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 已选日期显示 */}
            {selectedDate && (
              <div className="floating-todo-selected-date">
                已选：{selectedDate.format('M月D日')} {String(selectedHour).padStart(2, '0')}:
                {String(selectedMinute).padStart(2, '0')}
              </div>
            )}
          </div>
        )}
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
          tasks.map((task) => {
            const status = getDueDateStatus(task.dueDate);
            return (
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
                    {task.dueDate && status !== 'none' && (
                      <span className={`floating-todo-due-tag ${status}`}>
                        {formatDueDate(task.dueDate, status)}
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
            );
          })
        )}
      </div>
    </BaseFloatingWindow>
  );
};

export default FloatingTodoWindow;
