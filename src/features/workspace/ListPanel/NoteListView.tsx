import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { NoteIndex } from '../../../services/types';
import NoteCard from '../NoteCard/NoteCard';
import { NoteCardListContext } from '../NoteCard/NoteCardContext';
import { getThemeColor } from '../../../theme/theme';
import { useWorkspaceStore } from '../../../store/workspaceStore';

interface NoteListViewProps {
  flex: string | number;
}

/**
 * NoteListView - 便签列表视图组件
 * 专门负责展示和管理便签列表
 */
export const NoteListView: React.FC<NoteListViewProps> = ({ flex }) => {
  // Store 状态
  const { selectedFolderId, selectedNoteId, refreshListTrigger, setSelectedNote } =
    useWorkspaceStore();

  // 本地状态
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [folderName, setFolderName] = useState('未选择');
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

  // 加载便签列表
  const loadNotes = useCallback(async () => {
    if (!selectedFolderId) return;

    try {
      const noteList = await window.storage.listNotes(selectedFolderId);
      setNotes(noteList);

      // 获取文件夹名称
      const folders = await window.storage.listFolders();
      const folder = folders.find((f) => f.id === selectedFolderId);
      setFolderName(folder?.name || '未知文件夹');
    } catch (error) {
      console.error('Failed to load notes:', error);
      message.error('加载便签失败');
    }
  }, [selectedFolderId]);

  useEffect(() => {
    if (!selectedFolderId) return;
    loadNotes();
  }, [selectedFolderId, loadNotes, refreshListTrigger]);

  // 创建便签
  const handleCreateNote = async () => {
    if (!selectedFolderId) {
      message.warning('请先选择文件夹');
      return;
    }

    try {
      const newNote = await window.storage.createNote(selectedFolderId, {
        title: '无标题',
      });
      await loadNotes();
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
          await window.storage.deleteNote(id);
          await loadNotes();
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
          <span className="folder-name" title={folderName}>
            {folderName}
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
                onClick={() => setSelectedNote(note.id)}
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
