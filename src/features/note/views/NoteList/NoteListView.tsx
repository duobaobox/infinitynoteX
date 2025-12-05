import React, { useEffect } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import NoteCard, { CardListContext } from '../../../../components/BaseCard/cards/NoteCard';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useScrollOverflow } from '../../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../../hooks/useThemeColor';
import { useDebouncedSearch } from '../../../../hooks/useDebouncedSearch';

interface NoteListViewProps {
  flex: string | number;
}

/**
 * NoteListView - 便签列表视图组件
 * 专门负责展示和管理便签列表
 */
export const NoteListView: React.FC<NoteListViewProps> = ({ flex }) => {
  // Store 状态（优化：使用 selector 减少重渲染）
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

  // 使用公共 hooks
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();
  const { searchInput, setSearchInput, searchQuery } = useDebouncedSearch();

  // 监听刷新触发器，自动重新加载 notes
  useEffect(() => {
    if (selectedFolderId) {
      loadNotes(selectedFolderId);
    }
  }, [refreshListTrigger, selectedFolderId, loadNotes]);

  // 创建便签
  const handleCreateNote = async () => {
    if (!selectedFolderId) {
      message.warning('请先选择文件夹');
      return;
    }

    try {
      const newNote = await createNote(selectedFolderId);
      setSelectedNote(newNote.id);
    } catch (error) {
      console.error('Failed to create note:', error);
      message.error('创建便签失败');
    }
  };

  // 删除便签
  const handleDeleteNote = async (id: string, title: string) => {
    Modal.confirm({
      title: '删除便签',
      content: `确定删除便签"${title || '无标题'}"吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await deleteNote(id);
          if (selectedNoteId === id) {
            setSelectedNote(null);
          }
        } catch (error) {
          console.error('Failed to delete note:', error);
          message.error('删除失败');
          throw error;
        }
      },
    });
  };

  // 钉住便签 - 创建悬浮窗口
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

  // 筛选便签
  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="layout-panel list-container" style={{ flex }}>
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
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateNote}
              title="新建便签"
            />
          </div>
        </div>
        <Input
          allowClear
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>
      <div className="flex-vertical-equal" ref={containerRef}>
        <CardListContext.Provider value={{ selectedId: selectedNoteId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableRef}>
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                title={note.title}
                content={note.excerpt}
                color={note.color || 'ffffff'}
                onClick={() => {
                  setSelectedNote(note.id);
                  resetEditorTab();
                }}
                onPin={() => handlePinNote(note.id)}
                actions={
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id, note.title);
                    }}
                  />
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
