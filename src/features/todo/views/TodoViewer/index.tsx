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
import { Segmented, Button, Checkbox, Empty, Input, Popconfirm } from 'antd';
import {
  FileTextOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
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

  const loadParsedTasks = useWorkspaceStore((state) => state.loadParsedTasks);
  const loadManualTasks = useWorkspaceStore((state) => state.loadManualTasks);
  const toggleParsedTaskChecked = useWorkspaceStore((state) => state.toggleParsedTaskChecked);
  const createManualTask = useWorkspaceStore((state) => state.createManualTask);
  const toggleManualTask = useWorkspaceStore((state) => state.toggleManualTask);
  const deleteManualTask = useWorkspaceStore((state) => state.deleteManualTask);
  const setWorkspaceView = useWorkspaceStore((state) => state.setWorkspaceView);
  const setSelectedFolder = useWorkspaceStore((state) => state.setSelectedFolder);
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);

  // ============ 本地状态 ============
  const [filter, setFilter] = useState<FilterType>('pending');
  const [newTaskText, setNewTaskText] = useState('');

  // 动态主题色
  const themeColor = useThemeColor();

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

  // ============ 派生数据 ============

  // 筛选便签任务
  const filteredParsedTasks = useMemo(() => {
    let result = parsedTasks;

    if (filter === 'pending') {
      result = result.filter((t: ParsedTask) => !t.checked);
    } else if (filter === 'completed') {
      result = result.filter((t: ParsedTask) => t.checked);
    }

    return result.sort((a: ParsedTask, b: ParsedTask) => b.updatedAt - a.updatedAt);
  }, [parsedTasks, filter]);

  // 筛选手动任务
  const filteredManualTasks = useMemo(() => {
    let result = currentManualTasks;

    if (filter === 'pending') {
      result = result.filter((t: ManualTaskIndex) => !t.checked);
    } else if (filter === 'completed') {
      result = result.filter((t: ManualTaskIndex) => t.checked);
    }

    return result.sort((a: ManualTaskIndex, b: ManualTaskIndex) => a.order - b.order);
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
    await createManualTask(selectedTodoListId, newTaskText.trim());
    setNewTaskText('');
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
          <div className="todo-viewer__add-task">
            <Input
              placeholder="添加新任务，按回车确认"
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
                      <span className="todo-task-item__time">
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </span>
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
                  <div className="todo-task-item__meta">
                    <span className="todo-task-item__time">
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {new Date(task.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Popconfirm
                  title="删除任务"
                  description="确定要删除这个任务吗？"
                  onConfirm={() => deleteManualTask(task.id, selectedTodoListId)}
                  okText="删除"
                  cancelText="取消"
                >
                  <DeleteOutlined className="todo-task-item__delete" />
                </Popconfirm>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TodoViewer;
