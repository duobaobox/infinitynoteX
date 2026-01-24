/**
 * NoteListView - 便签列表视图组件
 *
 * 【组件职责】
 * - 展示当前文件夹下的便签列表
 * - 支持新建、删除、搜索便签
 * - 支持"钉住"便签（创建悬浮窗口）
 * - 作为 Note 模块的左侧列表区
 *
 * 【数据流】
 * 1. 从 workspaceStore 获取便签列表 (notes) 和当前文件夹 (selectedFolderId)
 * 2. 用户点击便签卡片 → 设置 selectedNoteId → 右侧编辑器加载对应便签
 * 3. 新建/删除便签 → 调用 store action → 刷新列表
 *
 * 【使用的共享组件】
 * - NoteCard: 便签卡片组件
 * - CardListContext: 用于传递选中状态
 */

import React, { useEffect, useState } from 'react';
import { Input, Badge, Button, message, Popconfirm, Tooltip } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import NoteCard, { CardListContext } from '../../../../components/BaseCard/cards/NoteCard';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../../hooks/useThemeColor';
import { useDebouncedSearch } from '../../../../hooks/useDebouncedSearch';

interface NoteListViewProps {
  /** 列表容器的 flex 值，由父组件传入 */
  flex: string | number;
}

/**
 * NoteListView 主组件
 */
export const NoteListView: React.FC<NoteListViewProps> = ({ flex }) => {
  // ============ Store 状态 ============
  const selectedFolderId = useWorkspaceStore((state) => state.selectedFolderId);
  const selectedNoteId = useWorkspaceStore((state) => state.selectedNoteId);
  const notes = useWorkspaceStore((state) => state.notes);
  const currentFolderName = useWorkspaceStore((state) => state.currentFolderName);
  const refreshListTrigger = useWorkspaceStore((state) => state.refreshListTrigger);
  const loadNotes = useWorkspaceStore((state) => state.loadNotes);
  const createNote = useWorkspaceStore((state) => state.createNote);
  const deleteNote = useWorkspaceStore((state) => state.deleteNote);
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);
  const resetEditorTab = useWorkspaceStore((state) => state.resetEditorTab);

  // ============ Hooks ============
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();
  const { searchInput, setSearchInput, searchQuery } = useDebouncedSearch();

  // 排序状态：'asc' = 旧→新，'desc' = 新→旧
  // 排序状态：'asc' = 旧→新，'desc' = 新→旧
  const STORAGE_KEY = 'note_list_sort_order';
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem(STORAGE_KEY) as 'asc' | 'desc') || 'asc';
  });

  const toggleSort = () => {
    setSortOrder((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  // ============ 副作用 ============

  // 监听刷新触发器，自动重新加载 notes
  useEffect(() => {
    if (selectedFolderId) {
      loadNotes(selectedFolderId);
    }
  }, [refreshListTrigger, selectedFolderId, loadNotes]);

  // ============ 事件处理 ============

  /** 创建新便签 */
  const handleCreateNote = async () => {
    if (!selectedFolderId) {
      message.warning('请先选择文件夹');
      return;
    }

    try {
      const newNote = await createNote(selectedFolderId);
      setSelectedNote(newNote.id); // 自动选中新建的便签
    } catch (error) {
      console.error('Failed to create note:', error);
      message.error('创建便签失败');
    }
  };

  /** 删除便签 */
  const handleDeleteNote = async (id: string) => {
    try {
      await deleteNote(id);
      // 如果删除的是当前选中的便签，清空选中状态
      if (selectedNoteId === id) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      message.error('删除失败');
    }
  };

  /** 钉住便签 - 创建悬浮窗口 */
  const handlePinNote = async (noteId: string) => {
    try {
      const result = await window.floatingWindow.createWindow(noteId);
      if (result.success) {
        message.success('已创建悬浮便签');
      } else {
        message.info(result.message || '窗口已存在');
      }
    } catch (error) {
      console.error('Failed to create floating window:', error);
      message.error('创建悬浮窗口失败');
    }
  };

  // ============ 派生数据 ============

  // ============ 派生数据 ============

  // 根据搜索关键词过滤便签列表
  const filteredNotes = React.useMemo(() => {
    if (!searchQuery) return notes;
    return notes.filter((note) => note.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [notes, searchQuery]);

  // 排序：按 createdAt 排序
  const sortedNotes = React.useMemo(() => {
    return [...filteredNotes].sort((a, b) =>
      sortOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt,
    );
  }, [filteredNotes, sortOrder]);

  // ============ 主渲染 ============

  return (
    <div className="layout-panel list-container" style={{ flex }}>
      {/* 头部区域：文件夹名 + 操作按钮 */}
      <div className="flex-vertical-auto">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="folder-name" title={currentFolderName}>
            {currentFolderName}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge count={filteredNotes.length} showZero style={{ backgroundColor: themeColor }} />
            <Tooltip title={sortOrder === 'asc' ? '当前：旧→新' : '当前：新→旧'}>
              <Button
                type="text"
                size="small"
                icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                onClick={toggleSort}
              />
            </Tooltip>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateNote}
              title="新建便签"
            />
          </div>
        </div>
        {/* 搜索框 */}
        <Input
          allowClear
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>

      {/* 列表区域 */}
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedNoteId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableRef}>
            {sortedNotes.map((note) => (
              <NoteCard
                key={note.id}
                title={note.title}
                content={note.excerpt}
                color={note.color || 'ffffff'}
                onClick={() => {
                  setSelectedNote(note.id);
                }}
                onDoubleClick={() => {
                  setSelectedNote(note.id);
                  resetEditorTab();
                }}
                onPin={() => handlePinNote(note.id)}
                actions={
                  <Popconfirm
                    title="删除便签"
                    description={`确定删除"${note.title || '无标题'}"吗？`}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    okText="删除"
                    cancelText="取消"
                    placement="right"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                }
                id={note.id}
              />
            ))}
          </div>
        </CardListContext.Provider>
      </div>
    </div>
  );
};
