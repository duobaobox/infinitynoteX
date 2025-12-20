/**
 * TodoCardListView - 清单卡片列表视图
 *
 * 【组件职责】
 * - 左侧列表：显示所有 Todo 清单（使用 BaseCard 统一样式）
 * - 第一个默认清单是「便签任务」
 * - 可创建和删除自定义清单
 */

import React, { useEffect, useState } from 'react';
import { Input, Button, Modal, Empty } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import TodoListCard, { CardListContext } from '../../../../components/BaseCard/cards/TodoListCard';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../hooks/useScrollOverflow';
import type { TodoList } from '../../types';
import './TodoCardListView.css';

interface TodoCardListViewProps {
  flex: string | number;
}

export const TodoCardListView: React.FC<TodoCardListViewProps> = ({ flex }) => {
  // ============ Store 状态 ============
  const todoLists = useWorkspaceStore((state) => state.todoLists);
  const selectedTodoListId = useWorkspaceStore((state) => state.selectedTodoListId);
  const selectTodoList = useWorkspaceStore((state) => state.selectTodoList);
  const loadTodoLists = useWorkspaceStore((state) => state.loadTodoLists);
  const createTodoList = useWorkspaceStore((state) => state.createTodoList);
  const deleteTodoList = useWorkspaceStore((state) => state.deleteTodoList);

  // ============ Hooks ============
  const { scrollableRef, containerRef } = useScrollOverflow();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  // ============ 副作用 ============

  useEffect(() => {
    loadTodoLists();
  }, [loadTodoLists]);

  // ============ 派生数据 ============

  const filteredLists = searchQuery
    ? todoLists.filter((list) => list.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : todoLists;

  // ============ 事件处理 ============

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    await createTodoList(newListName.trim());
    setNewListName('');
    setIsCreateModalOpen(false);
  };

  const handleDeleteList = async (listId: string) => {
    await deleteTodoList(listId);
  };

  // ============ 主渲染 ============

  return (
    <div className="layout-panel list-container" style={{ flex }}>
      {/* 头部区域 */}
      <div className="flex-vertical-auto">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="folder-name" title="任务清单">
            任务清单
          </span>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalOpen(true)}
          />
        </div>

        {/* 搜索框 */}
        <Input
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索清单"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>

      {/* 清单列表区域 */}
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedTodoListId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableRef}>
            {filteredLists.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchQuery ? '没有找到匹配的清单' : '暂无清单'}
                style={{ marginTop: 40 }}
              />
            ) : (
              filteredLists.map((list: TodoList) => (
                <TodoListCard
                  key={list.id}
                  id={list.id}
                  name={list.name}
                  isDefault={list.isDefault}
                  color={list.color}
                  onClick={() => selectTodoList(list.id)}
                  onDelete={list.isDefault ? undefined : () => handleDeleteList(list.id)}
                />
              ))
            )}
          </div>
        </CardListContext.Provider>
      </div>

      {/* 新建清单弹窗 */}
      <Modal
        title="新建清单"
        open={isCreateModalOpen}
        onOk={handleCreateList}
        onCancel={() => {
          setIsCreateModalOpen(false);
          setNewListName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入清单名称"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onPressEnter={handleCreateList}
          autoFocus
        />
      </Modal>
    </div>
  );
};
