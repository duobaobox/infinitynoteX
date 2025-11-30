import React, { useState, useEffect, useRef } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import NoteCard from '../../../../components/NoteCard/NoteCard';
import { NoteCardListContext } from '../../../../components/CardContext/CardContext';
import { getThemeColor } from '../../../../theme/theme';
import { useWorkspaceStore } from '../../../../store/workspaceStore';

interface NoteListViewProps {
  flex: string | number;
}

/**
 * NoteListView - 便签列表视图组件
 * 专门负责展示和管理便签列表
 */
export const NoteListView: React.FC<NoteListViewProps> = ({ flex }) => {
  // Store 状态
  const {
    selectedFolderId,
    selectedNoteId,
    notes, // 从 Store 获取 notes
    currentFolderName, // 从 Store 获取 currentFolderName
    refreshListTrigger, // 监听刷新触发器
    loadNotes, // 用于重新加载 notes
    createNote, // 从 Store 获取 createNote
    deleteNote, // 从 Store 获取 deleteNote
    setSelectedNote,
    resetEditorTab,
  } = useWorkspaceStore();

  // 本地状态（仅 UI 状态）
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 监听主题色变化
  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setThemeColor(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // 监听刷新触发器，自动重新加载 notes（修复颜色和内容更新问题）
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
      const newNote = await createNote(selectedFolderId); // 使用 Store Action
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
          await deleteNote(id); // 使用 Store Action
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

  // 检测滚动条
  useEffect(() => {
    const scrollableElement = scrollableListRef.current;
    if (!scrollableElement) return;

    const resizeObserver = new ResizeObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    resizeObserver.observe(scrollableElement);

    const mutationObserver = new MutationObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    mutationObserver.observe(scrollableElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // 动态更新 padding
  useEffect(() => {
    if (flexVerticalEqualRef.current) {
      if (isOverflow) {
        flexVerticalEqualRef.current.style.paddingRight = '0px';
      } else {
        flexVerticalEqualRef.current.style.paddingRight = '10px';
      }
    }
  }, [isOverflow]);

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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索"
          prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
          style={{ width: '100%' }}
        />
      </div>
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <NoteCardListContext.Provider value={{ selectedId: selectedNoteId ?? undefined }}>
          <div className="scrollable-list" ref={scrollableListRef}>
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
        </NoteCardListContext.Provider>
      </div>
    </div>
  );
};
