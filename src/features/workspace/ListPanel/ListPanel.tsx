import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input, Badge, Button, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { NoteIndex } from '../../../services/types';
import NoteCard from '../NoteCard/NoteCard';
import AIConversationCard from '../NoteCard/AIConversationCard';
import { NoteCardListContext } from '../NoteCard/NoteCardContext';
import { getThemeColor } from '../../../theme/theme';
import { DEFAULT_TOOLS, type AIConversationPreview } from '../../../constants/tools';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import './ListPanel.css';

// ListPanel 只保留 flex 作为 prop，其他状态从 Store 获取
interface ListPanelProps {
  flex: string | number;
}

const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  // 从 Store 获取状态
  const {
    selectedFolderId,
    selectedNoteId,
    selectedToolId,
    selectedToolItemId,
    workspaceView,
    refreshListTrigger,
    setSelectedNote,
    setSelectedTool,
    setSelectedToolItem,
  } = useWorkspaceStore();
  // 本地状态
  const [themeColor, setThemeColor] = React.useState(getThemeColor());
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [folderName, setFolderName] = useState('未选择');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiConversations, setAiConversations] = useState<AIConversationPreview[]>([]);

  const isNoteView = workspaceView === 'note';
  const toolList = DEFAULT_TOOLS;
  const effectiveToolId = selectedToolId || toolList[0]?.id || null;
  const isAiChatView = !isNoteView && effectiveToolId === 'ai-chat';

  // 加载 AI 对话列表
  const loadAiConversations = useCallback(async () => {
    try {
      const conversations = await window.storage.getAIConversations();
      setAiConversations(
        conversations.map((c) => ({
          id: c.id,
          title: c.title,
          excerpt: c.excerpt,
          updatedAt: c.updatedAt,
          color: 'd6e4ff',
        })),
      );
    } catch (error) {
      console.error('Failed to load AI conversations:', error);
    }
  }, []);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setThemeColor(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // 初始化加载 AI 对话列表
  useEffect(() => {
    if (!isNoteView && effectiveToolId === 'ai-chat') {
      loadAiConversations();
    }
  }, [isNoteView, effectiveToolId, loadAiConversations]);

  // 监听 AI 对话更新事件（标题编辑等）
  useEffect(() => {
    const handleConversationUpdate = () => {
      if (isAiChatView) {
        loadAiConversations();
      }
    };

    window.addEventListener('ai-conversation-updated', handleConversationUpdate);
    return () => window.removeEventListener('ai-conversation-updated', handleConversationUpdate);
  }, [isAiChatView, loadAiConversations]);

  // 加载便签列表
  const loadNotes = useCallback(async () => {
    if (!selectedFolderId || !isNoteView) return;

    try {
      // 加载便签列表
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
  }, [selectedFolderId, isNoteView]);

  useEffect(() => {
    if (!selectedFolderId || !isNoteView) return;
    loadNotes();
  }, [selectedFolderId, isNoteView, loadNotes, refreshListTrigger]);

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
      // 创建成功不再弹窗提醒
    } catch (error) {
      console.error('Failed to create note:', error);
      message.error('创建便签失败');
    }
  };

  // 筛选便签（简单的标题搜索）
  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // 处理钉住按钮 - 创建悬浮窗口
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
          // 删除成功不再弹窗提醒
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

  if (isAiChatView) {
    const filteredAiConversations = aiConversations.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleCreateAIConversation = async () => {
      try {
        const newConversation = await window.storage.createAIConversation();
        await loadAiConversations();
        // 自动选中新创建的对话
        setSelectedToolItem(newConversation.id);
        message.success('新建对话成功');
      } catch (error) {
        console.error('Failed to create AI conversation:', error);
        message.error('创建对话失败');
      }
    };

    const handleDeleteAIConversation = async (id: string, title: string) => {
      // 检查是否为默认对话
      if (title === '默认对话') {
        message.warning('默认对话无法删除');
        return;
      }

      Modal.confirm({
        title: '删除对话',
        content: `确定删除对话"${title}"吗？`,
        okText: '删除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        async onOk() {
          try {
            await window.storage.deleteAIConversation(id);

            // 如果删除的是当前选中的对话，自动切换到第一个对话
            if (selectedToolItemId === id) {
              const updatedConversations = await window.storage.getAIConversations();
              if (updatedConversations.length > 0) {
                setSelectedToolItem(updatedConversations[0].id);
              } else {
                setSelectedToolItem('');
              }
            }

            await loadAiConversations();
          } catch (error) {
            console.error('Failed to delete AI conversation:', error);
            message.error('删除对话失败');
            throw error;
          }
        },
      });
    };

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
            <span className="folder-name" title="AI对话">
              AI对话
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge
                count={filteredAiConversations.length}
                showZero
                style={{ backgroundColor: themeColor }}
              />
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleCreateAIConversation}
                title="新建AI对话"
              />
            </div>
          </div>
          <Input
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索AI对话"
            prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
            style={{ width: '100%' }}
          />
        </div>
        <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
          <NoteCardListContext.Provider value={{ selectedId: selectedToolItemId ?? undefined }}>
            <div className="scrollable-list" ref={scrollableListRef}>
              {filteredAiConversations.map((session) => (
                <AIConversationCard
                  key={session.id}
                  title={session.title}
                  content={session.excerpt}
                  onClick={() => setSelectedToolItem(session.id)}
                  actions={
                    session.title !== '默认对话' ? (
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAIConversation(session.id, session.title);
                        }}
                      />
                    ) : null
                  }
                  id={session.id}
                />
              ))}
            </div>
          </NoteCardListContext.Provider>
        </div>
      </div>
    );
  }

  if (!isNoteView) {
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
            <span className="folder-name" title="工具集合">
              工具集合
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge count={toolList.length} showZero style={{ backgroundColor: themeColor }} />
              <Button type="text" size="small" disabled>
                管理中
              </Button>
            </div>
          </div>
          <Input
            allowClear
            disabled
            placeholder="工具搜索即将上线"
            prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />}
            style={{ width: '100%' }}
          />
        </div>
        <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
          <div className="scrollable-list" ref={scrollableListRef}>
            {toolList.map((tool) => (
              <div
                key={tool.id}
                className={`tool-card${tool.id === effectiveToolId ? ' tool-card-selected' : ''}`}
                onClick={() => setSelectedTool(tool.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTool(tool.id);
                  }
                }}
              >
                <div>
                  <div className="tool-card-title">{tool.name}</div>
                  <div className="tool-card-desc">{tool.description}</div>
                </div>
                <span className="tool-card-icon">{tool.icon}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
                // 传递当前卡片id给 context
                id={note.id}
              />
            ))}
          </div>
        </NoteCardListContext.Provider>
      </div>
    </div>
  );
};

export default ListPanel;
