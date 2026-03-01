/**
 * NoteEditor - 便签编辑器容器
 *
 * 【组件职责】
 * - 管理便签编辑区域的多 Tab 切换 (编辑 / 工具 / AI / 其他)
 * - 协调便签数据的加载和保存
 * - 作为 Note 模块的右侧主编辑区
 *
 * 【数据流】
 * 1. 从 workspaceStore 获取当前选中的便签 ID (selectedNoteId)
 * 2. 加载便签数据 (标题、内容、颜色)
 * 3. 编辑时通过 useNoteSave Hook 防抖保存
 * 4. 切换便签时先保存当前内容，再加载新便签
 *
 * 【如何添加新 Tab】
 * 1. 在 tabs/ 目录创建新组件 (如 MyTab.tsx)
 * 2. 在 tabs/index.ts 的 TAB_CONFIG 中添加配置
 * 3. 在 types.ts 的 TabKeyType 中添加新 key
 * 4. 在本文件的 renderTabContent() 中添加 case
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Segmented, Splitter, message, Spin } from 'antd';
import type { TipTapJSONContent } from '../../../../services/types';
import type { NoteColor as NoteColorType } from '../../../../services/types';
import type { NoteSyncPayload } from '../../../../shared/types/ipc';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useSettingsStore } from '../../../../store/settingsStore';
import { IPC_CHANNELS } from '../../../../shared/types/ipc';
import {
  createNoteSyncPayload,
  getRendererIpcSourceId,
  onRendererIpc,
  sendRendererIpc,
} from '../../../../shared/utils/ipcEvents';

// 从模块导入
import type { TabKeyType } from './types';
import { useNoteSave } from './hooks/useNoteSave';
import { EditTab, ToolsTab, TAB_CONFIG } from './tabs';
import './tabs/AITab.css';

const AITab = lazy(() =>
  import('./tabs/AITab').then((module) => ({
    default: module.AITab,
  })),
);

const CanvasTab = lazy(() =>
  import('./tabs/CanvasTab').then((module) => ({
    default: module.CanvasTab,
  })),
);

/**
 * NoteEditor - 便签编辑器组件
 */
export const NoteEditor: React.FC = () => {
  // 从 Store 获取状态
  const selectedNoteId = useWorkspaceStore((state) => state.selectedNoteId);
  const triggerListRefresh = useWorkspaceStore((state) => state.triggerListRefresh);
  const resetEditorTabTrigger = useWorkspaceStore((state) => state.resetEditorTabTrigger);
  const noteTaskPath = useWorkspaceStore((state) => state.noteTaskPath);
  const clearNoteTaskPath = useWorkspaceStore((state) => state.clearNoteTaskPath);

  // 从 Settings Store 获取无限画布开启状态
  const enableInfiniteCanvas = useSettingsStore((state) => state.enableInfiniteCanvas);

  // 本地状态
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<TipTapJSONContent | string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKeyType>('edit');
  const [noteColor, setNoteColor] = useState<NoteColorType>('ffffff');
  const [isContentLoading, setIsContentLoading] = useState(false);

  // 监听无限画布开启状态，如果关闭且当前在画布 Tab，则切回编辑 Tab
  useEffect(() => {
    if (!enableInfiniteCanvas && activeTab === 'other') {
      setActiveTab('edit');
    }
  }, [enableInfiniteCanvas, activeTab]);

  // 跟踪“本窗口本组件”发出的同步事件，避免回流后二次重载
  const localSyncKeySetRef = useRef<Set<string>>(new Set());
  const rendererSourceIdRef = useRef(getRendererIpcSourceId());
  const markLocalNoteSync = useCallback((payload: NoteSyncPayload) => {
    const key = `${payload.noteId}:${payload.revision}`;
    const syncKeys = localSyncKeySetRef.current;
    syncKeys.add(key);
    // 轻量限长，防止长期运行 Set 增长
    if (syncKeys.size > 200) {
      const oldestKey = syncKeys.values().next().value;
      if (typeof oldestKey === 'string') {
        syncKeys.delete(oldestKey);
      }
    }
  }, []);

  // 使用保存 hook
  const { debouncedSave, flushPendingSave, syncTaskBaseline } = useNoteSave({
    onNoteSynced: markLocalNoteSync,
  });

  // 当前便签 ID 引用
  const currentNoteIdRef = useRef<string | null>(null);

  const loadNote = useCallback(
    async (id: string) => {
      setIsContentLoading(true);
      try {
        const note = await window.storage.getNote(id);
        setNoteTitle(note.title);
        setEditorContent(note.content);
        setNoteColor(note.color || 'ffffff');
        syncTaskBaseline(id, note.title, note.content);
        // 延迟重置加载状态，给编辑器一点时间处理内容更新
        setTimeout(() => setIsContentLoading(false), 50);
      } catch (error) {
        console.error('Failed to load note:', error);
        message.error('加载便签失败');
        setIsContentLoading(false);
      }
    },
    [syncTaskBaseline],
  );

  // 切换便签时：先保存当前便签，再加载新便签
  useEffect(() => {
    const switchNote = async () => {
      await flushPendingSave();
      currentNoteIdRef.current = selectedNoteId;

      if (!selectedNoteId) {
        setNoteTitle('');
        setEditorContent(null);
        return;
      }

      await loadNote(selectedNoteId);
    };

    switchNote();
  }, [selectedNoteId, flushPendingSave, loadNote]);

  // 监听 tab 重置信号（如从画布双击跳转）
  useEffect(() => {
    setActiveTab('edit');
    // 重新加载当前便签的最新数据（画布中可能已修改）
    if (currentNoteIdRef.current) {
      loadNote(currentNoteIdRef.current);
    }
  }, [resetEditorTabTrigger, loadNote]);

  // 监听来自悬浮窗口的更新通知
  useEffect(() => {
    const handleFloatingNoteUpdate = async (_event: unknown, payload: NoteSyncPayload) => {
      const { noteId, sourceId, revision } = payload;
      if (noteId !== currentNoteIdRef.current) {
        return;
      }

      // 仅跳过“本组件自己发出的那一次”回流事件，不影响其他来源联动
      if (sourceId === rendererSourceIdRef.current) {
        const key = `${noteId}:${revision}`;
        if (localSyncKeySetRef.current.has(key)) {
          localSyncKeySetRef.current.delete(key);
          return;
        }
      }

      try {
        const note = await window.storage.getNote(noteId);
        setNoteTitle(note.title);
        setEditorContent(note.content);
        setNoteColor(note.color || 'ffffff');
        syncTaskBaseline(noteId, note.title, note.content);
      } catch (error) {
        console.error('Failed to reload note from floating window:', error);
      }
    };

    return onRendererIpc(IPC_CHANNELS.noteUpdated, handleFloatingNoteUpdate);
  }, [syncTaskBaseline]);

  // 标题变更处理
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setNoteTitle(newTitle);
      if (currentNoteIdRef.current && editorContent && typeof editorContent !== 'string') {
        debouncedSave(currentNoteIdRef.current, newTitle, editorContent);
      }
    },
    [editorContent, debouncedSave],
  );

  // 内容变更处理
  const handleContentChange = useCallback(
    (newContent: TipTapJSONContent) => {
      setEditorContent(newContent);
      if (currentNoteIdRef.current) {
        debouncedSave(currentNoteIdRef.current, noteTitle, newContent);
      }
    },
    [noteTitle, debouncedSave],
  );

  // 颜色变更处理
  const handleColorChange = useCallback(
    async (newColor: NoteColorType) => {
      if (!currentNoteIdRef.current) return;

      try {
        await window.storage.updateNote(currentNoteIdRef.current, { color: newColor });
        setNoteColor(newColor);
        const syncPayload = createNoteSyncPayload(currentNoteIdRef.current, {
          taskChanged: false,
        });
        markLocalNoteSync(syncPayload);
        sendRendererIpc(IPC_CHANNELS.noteChanged, syncPayload);
        triggerListRefresh();
      } catch (error) {
        console.error('Failed to update color:', error);
        message.error('更新颜色失败');
      }
    },
    [markLocalNoteSync, triggerListRefresh],
  );

  // 处理 Tab 切换
  const handleTabChange = async (key: string | number) => {
    const newTab = key as TabKeyType;

    // 1. 切换前先确保当前编辑器的变更已保存 (防止 Canvas 修改被覆盖，或丢失 EditTab 修改)
    await flushPendingSave();

    // 2. 切换 Tab
    setActiveTab(newTab);

    // 3. 如果切回编辑模式，且当前有选中的便签，重新加载数据
    // 必须重新加载，因为在 Canvas 模式下可能修改了内容 (通过 updateNote 更新了 DB)
    if (newTab === 'edit' && currentNoteIdRef.current) {
      await loadNote(currentNoteIdRef.current);
    }
  };

  // 使用配置生成 Segmented 选项
  const segmentOptions = useMemo(
    () =>
      TAB_CONFIG
        // 根据功能开关过滤 Tab
        .filter((tab) => {
          if (tab.key === 'other' && !enableInfiniteCanvas) {
            return false;
          }
          return true;
        })
        .map(({ key, icon: Icon, label }) => ({
          label: (
            <span>
              <Icon style={{ marginRight: 4 }} />
              {label}
            </span>
          ),
          value: key,
        })),
    [enableInfiniteCanvas],
  );

  // 渲染当前 Tab 内容
  const renderTabContent = () => {
    switch (activeTab) {
      case 'edit':
        return (
          <EditTab
            noteId={selectedNoteId}
            noteTitle={noteTitle}
            editorContent={editorContent}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
            taskPath={noteTaskPath}
            onTaskLocated={clearNoteTaskPath}
            isLoading={isContentLoading}
          />
        );
      case 'tools':
        return (
          <ToolsTab
            noteId={selectedNoteId}
            noteColor={noteColor}
            onColorChange={handleColorChange}
          />
        );
      case 'ai':
        return null; // AI Tab 的内容在主渲染中处理
      case 'other':
        return (
          <Suspense
            fallback={
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Spin />
              </div>
            }
          >
            <CanvasTab />
          </Suspense>
        );
      default:
        return null;
    }
  };

  // AI Tab 激活时使用左右分栏布局
  const isAITabActive = activeTab === 'ai';

  // 渲染左侧编辑器内容（AI Tab 激活时用）
  const renderEditorContent = () => {
    // AI 分栏模式下，左侧始终显示编辑器
    return (
      <EditTab
        noteId={selectedNoteId}
        noteTitle={noteTitle}
        editorContent={editorContent}
        onTitleChange={handleTitleChange}
        onContentChange={handleContentChange}
        taskPath={noteTaskPath}
        onTaskLocated={clearNoteTaskPath}
        isLoading={isContentLoading}
      />
    );
  };

  // AI Tab 激活时：左右分栏布局（使用 Splitter）
  if (isAITabActive) {
    return (
      <div className="layout-panel editor-container">
        <div className="flex-vertical-equal">
          {/* Tab 栏 */}
          <div style={{ display: 'inline-block' }}>
            <Segmented options={segmentOptions} value={activeTab} onChange={handleTabChange} />
          </div>
          {/* 内容区：编辑器 + AI 对话 左右分栏（可拖拽调整宽度） */}
          <Splitter className="ai-split-splitter">
            <Splitter.Panel>
              <div className="editor-content-side">{renderEditorContent()}</div>
            </Splitter.Panel>
            <Splitter.Panel defaultSize={380} min={380}>
              <div className="ai-side">
                <Suspense
                  fallback={
                    <div style={{ padding: 16, textAlign: 'center' }}>
                      <Spin />
                    </div>
                  }
                >
                  <AITab noteId={selectedNoteId} />
                </Suspense>
              </div>
            </Splitter.Panel>
          </Splitter>
        </div>
      </div>
    );
  }

  // 默认布局：单栏
  return (
    <div className="layout-panel editor-container">
      <div className="flex-vertical-equal">
        {/* 标签栏 */}
        <div style={{ display: 'inline-block' }}>
          <Segmented options={segmentOptions} value={activeTab} onChange={handleTabChange} />
        </div>

        {/* Tab 内容区 */}
        <div className="editor-inner-tab-container">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default NoteEditor;
