import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Segmented, message, Tooltip } from 'antd';
import {
  EditOutlined,
  ToolOutlined,
  RobotOutlined,
  AppstoreOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { TipTapEditor } from './TipTapEditor';
import type { TipTapJSONContent } from '../services/types';

interface EditorPanelProps {
  noteId: string | null;
  onClose?: () => void;
  onSave?: () => void; // 保存完成时的回调
}

const EditorPanel: React.FC<EditorPanelProps> = ({ noteId, onSave }) => {
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<string | number>('edit');
  const [noteColor, setNoteColor] = useState<
    'bae0ff' | 'd9f7be' | 'ffd6e7' | 'd6e4ff' | 'ffd666' | 'ffffff'
  >('ffffff');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);

  // 加载便签内容
  useEffect(() => {
    if (!noteId) {
      setNoteTitle('');
      setEditorContent(null);
      return;
    }

    loadNote(noteId);
    currentNoteIdRef.current = noteId;
  }, [noteId]);

  const loadNote = async (id: string) => {
    try {
      const note = await window.storage.getNote(id);
      setNoteTitle(note.title);
      setEditorContent(note.content);
      setNoteColor(note.color || 'ffffff');
    } catch (error) {
      console.error('Failed to load note:', error);
      message.error('加载便签失败');
    }
  };

  // 节流保存函数 (800ms)
  const debouncedSave = useCallback(
    (title: string, content: TipTapJSONContent) => {
      if (!currentNoteIdRef.current) return;

      // 清除之前的定时器
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // 设置新的定时器
      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.storage.updateNote(currentNoteIdRef.current!, {
            title,
            content,
          });
          console.log('Note auto-saved');
          // 保存成功后调用回调，通知列表更新
          onSave?.();
        } catch (error) {
          console.error('Failed to save note:', error);
          message.error('自动保存失败，请检查磁盘空间');
        }
      }, 800);
    },
    [onSave],
  );

  // 标题变更处理
  const handleTitleChange = (newTitle: string) => {
    setNoteTitle(newTitle);
    if (editorContent && typeof editorContent !== 'string') {
      debouncedSave(newTitle, editorContent);
    }
  };

  // 内容变更处理
  const handleContentChange = (newContent: TipTapJSONContent) => {
    setEditorContent(newContent);
    debouncedSave(noteTitle, newContent);
  };

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const segmentOptions = [
    {
      label: (
        <span>
          <EditOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'edit',
    },
    {
      label: (
        <span>
          <ToolOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'tools',
    },
    {
      label: (
        <span>
          <RobotOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'ai',
    },
    {
      label: (
        <span>
          <AppstoreOutlined style={{ marginRight: 4 }} />
        </span>
      ),
      value: 'other',
    },
  ];

  // 预设 6 色（与 NoteCard 约定相同）
  const presetColors: Array<{
    key: 'bae0ff' | 'd9f7be' | 'ffd6e7' | 'd6e4ff' | 'ffd666' | 'ffffff';
    label: string;
  }> = [
    { key: 'ffffff', label: '白色' },
    { key: 'bae0ff', label: '蓝' },
    { key: 'd6e4ff', label: '靛蓝' },
    { key: 'd9f7be', label: '绿' },
    { key: 'ffd666', label: '金' },
    { key: 'ffd6e7', label: '粉' },
  ];

  const handleChangeColor = async (
    color: 'bae0ff' | 'd9f7be' | 'ffd6e7' | 'd6e4ff' | 'ffd666' | 'ffffff',
  ) => {
    if (!currentNoteIdRef.current) return;
    try {
      await window.storage.updateNote(currentNoteIdRef.current, { color });
      setNoteColor(color);
      onSave?.(); // 通知列表刷新
      message.success('便签颜色已更新');
    } catch (e) {
      console.error('Failed to update color:', e);
      message.error('更新颜色失败');
    }
  };

  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented options={segmentOptions} value={activeTab} onChange={setActiveTab} />
        </div>
        <div className="editor-inner-tab-container">
          {activeTab === 'edit' && editorContent && (
            <TipTapEditor
              key={noteId} // 添加 key 确保切换便签时重新创建编辑器
              initialContent={editorContent}
              onContentChange={handleContentChange}
              title={noteTitle}
              onTitleChange={handleTitleChange}
            />
          )}
          {activeTab === 'tools' && (
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>便签颜色</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {presetColors.map((c) => (
                  <Tooltip key={c.key} title={c.label}>
                    <button
                      aria-label={`设为${c.label}`}
                      onClick={() => handleChangeColor(c.key)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: `#${c.key}`,
                        border:
                          c.key === noteColor
                            ? '2px solid var(--ant-color-primary)'
                            : '1px solid var(--border-color)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: c.key === noteColor ? '0 0 0 2px rgba(24,144,255,0.15)' : 'none',
                      }}
                    >
                      {c.key === noteColor ? <CheckOutlined style={{ color: '#1677ff' }} /> : null}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'ai' && <div style={{ padding: '16px' }}>AI 工作台</div>}
          {activeTab === 'other' && <div style={{ padding: '16px' }}>其他面板</div>}
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
