/**
 * TodoViewer - 任务列表编辑器视图
 *
 * 【组件职责】
 * - 右侧编辑器：显示当前选中清单的任务列表
 * - 子 Tab 用于筛选状态（全部/待办/完成）
 * - 便签任务（默认清单）：从便签解析的任务，可跳转源便签
 * - 手动任务（自定义清单）：支持添加/删除/勾选
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Segmented, Button, Checkbox, Empty, Input, Popconfirm, Modal, DatePicker } from 'antd';
import dayjs from 'dayjs';
import {
  FileTextOutlined,
  CheckSquareOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useThemeColor } from '../../../../hooks/useThemeColor';
import type { ParsedTask, ManualTaskIndex } from '../../types';
import { DEFAULT_TODO_LIST_ID } from '../../types';
import './TodoViewer.css';

type FilterType = 'all' | 'pending' | 'completed';

export const TodoViewer: React.FC = () => {
  // ============ Store 状态 ============
  const todoLists = useWorkspaceStore((state) => state.todoLists);
  const selectedTodoListId = useWorkspaceStore((state) => state.selectedTodoListId);
  const parsedTasks = useWorkspaceStore((state) => state.parsedTasks);
  const manualTasks = useWorkspaceStore((state) => state.manualTasks);

  const loadTodoLists = useWorkspaceStore((state) => state.loadTodoLists);
  const loadParsedTasks = useWorkspaceStore((state) => state.loadParsedTasks);
  const loadManualTasks = useWorkspaceStore((state) => state.loadManualTasks);
  const toggleParsedTaskChecked = useWorkspaceStore((state) => state.toggleParsedTaskChecked);
  const createManualTask = useWorkspaceStore((state) => state.createManualTask);
  const updateManualTask = useWorkspaceStore((state) => state.updateManualTask);
  const toggleManualTask = useWorkspaceStore((state) => state.toggleManualTask);
  const deleteManualTask = useWorkspaceStore((state) => state.deleteManualTask);
  const setWorkspaceView = useWorkspaceStore((state) => state.setWorkspaceView);
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder);
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);

  // ============ 本地状态 ============
  const [filter, setFilter] = useState<FilterType>('pending');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<number | undefined>();

  // 编辑任务弹窗状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState<number | undefined>();

  // 动态主题色
  const themeColor = useThemeColor();

  // ============ 辅助函数 ============
  // 日期状态类型：overdue/today/tomorrow/future
  type DueDateStatus = 'overdue' | 'today' | 'tomorrow' | 'future';

  const getDueStatus = (dueDate?: number): DueDateStatus => {
    if (!dueDate) return 'future';
    const now = dayjs();
    const due = dayjs(dueDate);
    const today = now.startOf('day');
    const tomorrow = today.add(1, 'day');
    const dueDay = due.startOf('day');

    // 判断是否有具体时间（不是 00:00:00）
    const hasTime = due.hour() !== 0 || due.minute() !== 0 || due.second() !== 0;

    if (hasTime) {
      // 有具体时间：精确比较
      if (due.isBefore(now)) return 'overdue';
      if (due.isSame(now, 'day')) return 'today';
      if (dueDay.isSame(tomorrow)) return 'tomorrow';
    } else {
      // 纯日期：按日比较
      if (dueDay.isBefore(today)) return 'overdue';
      if (dueDay.isSame(today)) return 'today';
      if (dueDay.isSame(tomorrow)) return 'tomorrow';
    }
    return 'future';
  };

  // ============ 派生数据 ============
  const isDefaultList = selectedTodoListId === DEFAULT_TODO_LIST_ID;
  const currentList = todoLists.find((l) => l.id === selectedTodoListId);
  const currentManualTasks = manualTasks[selectedTodoListId || ''] || [];

  // ============ 副作用 ============

  // 加载便签任务
  useEffect(() => {
    if (isDefaultList) {
      loadParsedTasks();
    }
  }, [isDefaultList, loadParsedTasks]);

  // 加载手动任务
  useEffect(() => {
    if (selectedTodoListId && !isDefaultList) {
      loadManualTasks(selectedTodoListId);
    }
  }, [selectedTodoListId, isDefaultList, loadManualTasks]);

  // 监听悬浮窗口的任务变化，同步刷新数据
  useEffect(() => {
    const handleTodoUpdate = async (_event: unknown, updatedListId: string) => {
      // 如果更新的是当前选中的清单，重新加载数据
      if (updatedListId === selectedTodoListId) {
        if (isDefaultList) {
          await loadParsedTasks();
        } else {
          await loadManualTasks(updatedListId);
        }
      }
      // 同时刷新清单列表（以更新任务计数等）
      await loadTodoLists();
    };

    window.ipcRenderer?.on('todo:updated', handleTodoUpdate);
    return () => {
      window.ipcRenderer?.off('todo:updated', handleTodoUpdate);
    };
  }, [selectedTodoListId, isDefaultList, loadParsedTasks, loadManualTasks, loadTodoLists]);

  // ============ 派生数据 ============

  // 筛选便签任务
  const filteredParsedTasks = useMemo(() => {
    let result = parsedTasks;

    if (filter === 'pending') {
      result = result.filter((t: ParsedTask) => !t.checked);
    } else if (filter === 'completed') {
      result = result.filter((t: ParsedTask) => t.checked);
    }

    return result.sort((a: ParsedTask, b: ParsedTask) => {
      // 优先按截止日期排序，再按更新时间
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [parsedTasks, filter]);

  // 筛选手动任务
  const filteredManualTasks = useMemo(() => {
    let result = currentManualTasks;

    if (filter === 'pending') {
      result = result.filter((t: ManualTaskIndex) => !t.checked);
    } else if (filter === 'completed') {
      result = result.filter((t: ManualTaskIndex) => t.checked);
    }

    return result.sort((a, b) => {
      // 如果有截止日期，按截止日期排序，否则按 order
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.order - b.order;
    });
  }, [currentManualTasks, filter]);

  // 统计
  const stats = useMemo(() => {
    const tasks = isDefaultList ? parsedTasks : currentManualTasks;
    const pending = tasks.filter((t: ParsedTask | ManualTaskIndex) => !t.checked).length;
    const completed = tasks.filter((t: ParsedTask | ManualTaskIndex) => t.checked).length;
    return { total: tasks.length, pending, completed };
  }, [isDefaultList, parsedTasks, currentManualTasks]);

  // ============ 事件处理 ============

  // 跳转到来源便签
  const handleGoToSource = (task: ParsedTask) => {
    setWorkspaceView('note');
    setSelectedFolder(task.folderId);
    setSelectedNote(task.noteId, task.path);
  };

  // 添加手动任务
  const handleAddTask = async () => {
    if (!newTaskText.trim() || !selectedTodoListId) return;
    await createManualTask(selectedTodoListId, newTaskText.trim(), newTaskDueDate);
    setNewTaskText('');
    setNewTaskDueDate(undefined);
  };

  // 打开编辑任务弹窗
  const handleOpenEditModal = (task: ManualTaskIndex) => {
    setEditingTaskId(task.id);
    setEditTaskText(task.text);
    setEditTaskDueDate(task.dueDate);
    setIsEditModalOpen(true);
  };

  // 编辑手动任务
  const handleEditTask = async () => {
    if (!editingTaskId || !editTaskText.trim() || !selectedTodoListId) return;
    await updateManualTask(editingTaskId, selectedTodoListId, {
      text: editTaskText.trim(),
      dueDate: editTaskDueDate,
    });
    setIsEditModalOpen(false);
    setEditingTaskId(null);
    setEditTaskText('');
    setEditTaskDueDate(undefined);
  };

  // ============ 渲染组件 ============

  // 格式化显示日期（统一格式）
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

  const renderDueDate = (dueDate?: number) => {
    if (!dueDate) return null;
    const status = getDueStatus(dueDate);
    return (
      <span className={`todo-task-item__due ${status}`}>
        <ClockCircleOutlined style={{ marginRight: 4 }} />
        {formatDueDate(dueDate, status)}
      </span>
    );
  };

  // ============ 渲染 ============

  // 未选中清单
  if (!selectedTodoListId || !currentList) {
    return (
      <div className="layout-panel editor-container">
        <div className="flex-vertical-equal" style={{ justifyContent: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请在左侧选择一个清单" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="layout-panel editor-container"
      style={{ '--dynamic-theme-color': themeColor } as React.CSSProperties}
    >
      <div className="flex-vertical-equal">
        {/* 头部：清单名称 + 筛选 Tab */}
        <div className="todo-viewer__header">
          <div className="todo-viewer__title">
            {isDefaultList ? (
              <FileTextOutlined style={{ marginRight: 8, color: currentList.color }} />
            ) : (
              <CheckSquareOutlined style={{ marginRight: 8, color: currentList.color }} />
            )}
            {currentList.name}
          </div>
          <Segmented
            size="small"
            value={filter}
            onChange={(v) => setFilter(v as FilterType)}
            options={[
              { label: `待办 (${stats.pending})`, value: 'pending' },
              { label: `完成 (${stats.completed})`, value: 'completed' },
              { label: `全部 (${stats.total})`, value: 'all' },
            ]}
          />
        </div>

        {/* 添加任务输入框（仅自定义清单） */}
        {!isDefaultList && (
          <div className="todo-viewer__add-task" style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="添加新任务"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              prefix={<PlusOutlined style={{ color: '#bfbfbf' }} />}
              style={{ flex: 1 }}
            />
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              placeholder="截止时间"
              value={newTaskDueDate ? dayjs(newTaskDueDate) : null}
              onChange={(date) => setNewTaskDueDate(date ? date.valueOf() : undefined)}
              style={{ width: 180 }}
            />
            <Button
              type="primary"
              disabled={!newTaskText.trim()}
              onClick={handleAddTask}
              style={{
                backgroundColor: themeColor,
                borderColor: themeColor,
                color: 'var(--white)',
              }}
            >
              添加
            </Button>
          </div>
        )}

        {/* 任务列表 */}
        <div className="todo-viewer__list">
          {isDefaultList ? (
            // 便签任务列表
            filteredParsedTasks.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  filter === 'all'
                    ? '便签中暂无任务'
                    : filter === 'pending'
                      ? '没有待办任务'
                      : '没有已完成任务'
                }
                style={{ marginTop: 60 }}
              />
            ) : (
              filteredParsedTasks.map((task: ParsedTask) => (
                <div key={task.id} className="todo-task-item">
                  <Checkbox
                    checked={task.checked}
                    onChange={() => toggleParsedTaskChecked(task.id)}
                  />
                  <div className="todo-task-item__content">
                    <div className={`todo-task-item__text ${task.checked ? 'checked' : ''}`}>
                      {task.text}
                    </div>
                    <div className="todo-task-item__meta">
                      <span
                        className="todo-task-item__source"
                        onClick={() => handleGoToSource(task)}
                      >
                        <FileTextOutlined style={{ marginRight: 4 }} />
                        {task.noteTitle}
                        <LinkOutlined style={{ marginLeft: 4, fontSize: 10 }} />
                      </span>
                      {renderDueDate(task.dueDate)}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : // 手动任务列表
          filteredManualTasks.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                filter === 'all'
                  ? '暂无任务，在上方输入框添加'
                  : filter === 'pending'
                    ? '没有待办任务'
                    : '没有已完成任务'
              }
              style={{ marginTop: 60 }}
            />
          ) : (
            filteredManualTasks.map((task: ManualTaskIndex) => (
              <div key={task.id} className="todo-task-item">
                <Checkbox
                  checked={task.checked}
                  onChange={() => toggleManualTask(task.id, selectedTodoListId)}
                />
                <div className="todo-task-item__content">
                  <div className={`todo-task-item__text ${task.checked ? 'checked' : ''}`}>
                    {task.text}
                  </div>
                  <div className="todo-task-item__meta">{renderDueDate(task.dueDate)}</div>
                </div>
                <div className="todo-task-item__actions">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleOpenEditModal(task)}
                  />
                  <Popconfirm
                    title="删除任务"
                    description="确定要删除这个任务吗？"
                    onConfirm={() => deleteManualTask(task.id, selectedTodoListId)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button type="text" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 编辑任务弹窗 */}
      <Modal
        title="编辑任务"
        open={isEditModalOpen}
        onOk={handleEditTask}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingTaskId(null);
          setEditTaskText('');
          setEditTaskDueDate(undefined);
        }}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            placeholder="请输入任务内容"
            value={editTaskText}
            onChange={(e) => setEditTaskText(e.target.value)}
            onPressEnter={handleEditTask}
            autoFocus
          />
          <div>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#8c8c8c' }}>截止日期：</div>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              placeholder="选择日期时间"
              value={editTaskDueDate ? dayjs(editTaskDueDate) : null}
              onChange={(date) => setEditTaskDueDate(date ? date.valueOf() : undefined)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TodoViewer;
