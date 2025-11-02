import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { NoteIndex } from '../services/types';
import NoteCard from './NoteCard/NoteCard';

interface ListPanelProps {
  flex: string | number;
  folderId: string | null;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string | null) => void;
}

const NOTE_COLOR = '#fa8c16'; // 便签主题色，与 colorPrimary 保持一致

const ListPanel: React.FC<ListPanelProps> = ({ flex, folderId, selectedNoteId, onSelectNote }) => {
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [folderName, setFolderName] = useState('未选择');
  const [searchQuery, setSearchQuery] = useState('');

  // 加载便签列表
  const loadNotes = useCallback(async () => {
    if (!folderId) return;

    try {
      // 加载便签列表
      const noteList = await window.storage.listNotes(folderId);
      setNotes(noteList);

      // 获取文件夹名称
      const folders = await window.storage.listFolders();
      const folder = folders.find((f) => f.id === folderId);
      setFolderName(folder?.name || '未知文件夹');
    } catch (error) {
      console.error('Failed to load notes:', error);
      message.error('加载便签失败');
    }
  }, [folderId]);

  useEffect(() => {
    if (!folderId) return;
    loadNotes();
  }, [folderId, loadNotes]);

  const handleCreateNote = async () => {
    if (!folderId) {
      message.warning('请先选择文件夹');
      return;
    }

    try {
      const newNote = await window.storage.createNote(folderId, {
        title: '无标题',
      });
      await loadNotes();
      onSelectNote(newNote.id);
      message.success('创建成功');
    } catch (error) {
      console.error('Failed to create note:', error);
      message.error('创建便签失败');
    }
  };

  // 筛选便签（简单的标题搜索）
  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDeleteNote = async (id: string, title: string) => {
    Modal.confirm({
      title: '删除便签',
      content: `确定删除便签“${title || '无标题'}”吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await window.storage.deleteNote(id);
          message.success('删除成功');
          await loadNotes();
          if (selectedNoteId === id) {
            onSelectNote(null);
          }
        } catch (error) {
          console.error('Failed to delete note:', error);
          message.error('删除失败');
          throw error;
        }
      },
    });
  };

  // 检测滚动条是否出现
  useEffect(() => {
    const scrollableElement = scrollableListRef.current;
    if (!scrollableElement) return;

    // 使用 ResizeObserver 监控容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      // 检查是否有垂直滚动条：scrollHeight > clientHeight
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    resizeObserver.observe(scrollableElement);

    // 同时监控 MutationObserver 捕捉内容变化
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

  // 根据溢出状态动态更新 padding
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
          <span style={{ fontSize: 14, fontWeight: 500 }}>{folderName}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge count={filteredNotes.length} showZero style={{ backgroundColor: NOTE_COLOR }} />
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
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          prefix={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <SearchOutlined style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12, color: '#999' }}>搜索</span>
            </span>
          }
        />
      </div>
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <div className="scrollable-list" ref={scrollableListRef}>
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              title={note.title}
              content={note.excerpt}
              color="ffffff"
              onClick={() => onSelectNote(note.id)}
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
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListPanel;
