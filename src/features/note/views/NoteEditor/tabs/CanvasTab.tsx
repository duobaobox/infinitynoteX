/**
 * CanvasTab - 无限画布视图
 *
 * 【组件职责】
 * - 以画布形式展示当前文件夹下的所有便签
 * - 支持拖拽、缩放、平移
 * - 与左侧列表双向联动
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  MiniMap,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  useOnViewportChange,
  type Node,
  type NodeChange,
  type Viewport,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Tooltip, message, Button, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  LayoutOutlined,
  EnvironmentOutlined,
  FullscreenOutlined,
  CloseOutlined,
  SaveOutlined,
  CopyOutlined,
} from '@ant-design/icons';

import { useWorkspaceStore } from '../../../../../store/workspaceStore';
import NoteNode, { type NoteNodeData } from './NoteNode';
import { ChatInput } from '../../../../ai-chat/components/ChatInput';
import { MarkdownRenderer } from '../../../../ai-chat/components/MarkdownRenderer';
import { useAIConfig, useAIChat } from '../../../../ai-chat/hooks';
import type { NoteReference } from '../../../../ai-chat/types';
import {
  extractTipTapText,
  convertMarkdownToTipTap,
  copyToClipboard,
  stripThinkBlocks,
  renderMarkdownToHtml,
} from '../../../../ai-chat/utils';
import { NOTE_COLOR_HEX_MAP, type NoteColorId } from '../../../../../constants/noteColors';
import './CanvasTab.css';

// 注册自定义节点类型（在组件外部定义，避免重复创建）
const nodeTypes = {
  note: NoteNode,
} as const;

// 网格布局参数
const GRID_COLS = 3;
const NODE_WIDTH = 400;
const NODE_HEIGHT = 400;
const GAP_X = 40;
const GAP_Y = 40;

/**
 * 计算节点的初始位置（网格布局）
 */
function calculateInitialPosition(index: number): { x: number; y: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: col * (NODE_WIDTH + GAP_X) + 50,
    y: row * (NODE_HEIGHT + GAP_Y) + 50,
  };
}

/**
 * 内部画布组件（需要包裹在 ReactFlowProvider 中）
 */
const CanvasInner: React.FC = () => {
  const notes = useWorkspaceStore((state) => state.notes);
  const selectedNoteId = useWorkspaceStore((state) => state.selectedNoteId);
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote);
  const selectedFolderId = useWorkspaceStore((state) => state.selectedFolderId);

  const { setCenter, getNode, fitView, setViewport } = useReactFlow();
  const isInitialMount = useRef(true);
  const prevNotesRef = useRef(notes);
  const noteCacheRef = useRef<
    Map<string, { id: string; title: string; content: string; color?: string }>
  >(new Map());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NoteNodeData>>([]);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 0.8 });
  const [showMiniMap, setShowMiniMap] = useState(false);

  // AI Chat 相关状态
  const { isConfigured, config, providerOptions, currentProviderId, switchProvider, isSwitching } =
    useAIConfig();

  const [noteItems, setNoteItems] = useState<MenuProps['items']>([]);
  const [selectedNotes, setSelectedNotes] = useState<
    Array<{ id: string; title: string; content: string; color?: string }>
  >([]);

  // AI回复相关状态
  const [aiResponse, setAiResponse] = useState<string>('');
  const [showAiResponse, setShowAiResponse] = useState(false);
  const aiResponseRef = useRef<HTMLDivElement>(null);

  // 画布临时对话：不加载历史，不保存
  const {
    isLoading: isStreaming,
    sendMessage,
    abort,
    chatItems,
    clearChat,
  } = useAIChat({
    conversationId: null,
    isConfigured,
    source: 'canvas',
    autoSave: false,
  });

  // 组件卸载时清理对话
  useEffect(() => {
    return () => clearChat();
  }, [clearChat]);

  // 监听 AI 消息变化，仅在有新 AI 回复时更新显示
  const prevChatItemsRef = useRef<typeof chatItems>([]);
  useEffect(() => {
    const lastItem = chatItems.length > 0 ? chatItems[chatItems.length - 1] : null;
    const hasNewAiMessage =
      chatItems.length > prevChatItemsRef.current.length &&
      chatItems.length > 0 &&
      lastItem?.role === 'ai';

    // 如果有新的 AI 消息，或者最后的消息是 AI 的且内容有更新，则更新显示
    if (lastItem?.role === 'ai') {
      setAiResponse(lastItem.content);
      if (hasNewAiMessage) {
        setShowAiResponse(true);
      }
    }

    prevChatItemsRef.current = chatItems;
  }, [chatItems]);

  // AI回复时自动滚动到底部
  useEffect(() => {
    if (aiResponse && aiResponseRef.current) {
      // 使用 smooth 滚动
      aiResponseRef.current.scrollTo({
        top: aiResponseRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [aiResponse]);

  // 加载便签列表（用于引用）
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const folders = await window.storage.listFolders();
        const items: MenuProps['items'] = [];
        for (const folder of folders) {
          const folderNotes = await window.storage.listNotes(folder.id);
          folderNotes.forEach((note) => {
            items.push({
              key: note.id,
              label: note.title || '无标题',
            });
          });
        }
        setNoteItems(items);
      } catch (err) {
        console.error('Failed to load notes for reference:', err);
      }
    };
    loadNotes();
  }, []);

  // 处理便签选择引用
  const handleNoteSelect: MenuProps['onClick'] = useCallback(
    async ({ key }: { key: string }) => {
      if (selectedNotes.some((n) => n.id === key)) {
        message.info('该便签已引用');
        return;
      }
      try {
        const note = await window.storage.getNote(key);
        const textContent = extractTipTapText(note.content);
        setSelectedNotes((prev) => [
          ...prev,
          { id: key, title: note.title || '无标题', content: textContent, color: note.color },
        ]);
      } catch (err) {
        console.error('Failed to load note:', err);
        message.error('加载便签失败');
      }
    },
    [selectedNotes],
  );

  // 移除已选便签
  const handleRemoveNote = useCallback((id: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 发送 AI 消息
  const handleSendMessage = useCallback(
    async (value: string, attachments?: NoteReference[]) => {
      if (!isConfigured) {
        message.warning('请先配置 AI 提供商');
        return;
      }
      setAiResponse(''); // 清空上次回复
      setShowAiResponse(false);
      try {
        await sendMessage(value, attachments);
        // 不清空引用，让用户可以基于同一组便签继续提问
      } catch (error) {
        message.error('发送失败，请重试');
      }
    },
    [sendMessage, isConfigured],
  );

  // 保存AI回复为便签
  const handleSaveAiResponse = useCallback(async () => {
    try {
      const exported = stripThinkBlocks(aiResponse);
      const tipTapContent = convertMarkdownToTipTap(exported);
      const firstLine = (exported.split('\n').find((l) => l.trim().length > 0) || '').trim();
      const title = (firstLine.substring(0, 30) || 'AI 回答').replace(/[#*`]/g, '').trim();

      await window.storage.createNote(selectedFolderId || 'default', {
        title,
        content: tipTapContent,
      });

      message.success('已保存到便签');
    } catch (error) {
      console.error('Failed to save AI response:', error);
      message.error('保存失败');
    }
  }, [aiResponse, selectedFolderId]);

  // 复制AI回复
  const handleCopyAiResponse = useCallback(() => {
    const textToCopy = stripThinkBlocks(aiResponse);
    const htmlToCopy = renderMarkdownToHtml(textToCopy);
    copyToClipboard(textToCopy, htmlToCopy)
      .then(() => message.success('已复制'))
      .catch(() => message.error('复制失败'));
  }, [aiResponse]);

  // 监听视口变化并保存
  useOnViewportChange({
    onChange: (newViewport) => {
      viewportRef.current = newViewport;
      // 保存视口状态到 localStorage
      if (selectedFolderId) {
        localStorage.setItem(`canvas-viewport-${selectedFolderId}`, JSON.stringify(newViewport));
      }
    },
  });

  // 恢复视口状态
  useEffect(() => {
    if (selectedFolderId) {
      const savedViewport = localStorage.getItem(`canvas-viewport-${selectedFolderId}`);
      if (savedViewport) {
        try {
          const parsedViewport = JSON.parse(savedViewport);
          setViewport(parsedViewport, { duration: 300 });
        } catch (error) {
          console.error('Failed to restore viewport:', error);
        }
      }
    }
  }, [selectedFolderId, setViewport]);

  // 统一处理节点更新：notes 变化或 selectedNoteId 变化
  // 优化策略：使用 ID 比对区分增删变化和属性更新
  useEffect(() => {
    const prevNotes = prevNotesRef.current;
    const notesChanged = notes !== prevNotes;

    setNodes((currentNodes) => {
      // 快速路径 1：仅选中状态变化
      if (!notesChanged && currentNodes.length === notes.length) {
        return currentNodes.map((node) => ({
          ...node,
          data: { ...node.data, isSelected: node.id === selectedNoteId },
        }));
      }

      // 构建 ID 集合用于比对
      const currentNodeIds = new Set(currentNodes.map((n) => n.id));
      const newNoteIds = new Set(notes.map((n) => n.id));

      // 检测是否有实际的增删操作
      const hasAdditions = notes.some((n) => !currentNodeIds.has(n.id));
      const hasDeletions = currentNodes.some((n) => !newNoteIds.has(n.id));

      // 快速路径 2：无增删，仅属性更新（标题、摘要、颜色等）
      if (!hasAdditions && !hasDeletions && currentNodes.length === notes.length) {
        const notesMap = new Map(notes.map((n) => [n.id, n]));
        return currentNodes.map((node) => {
          const note = notesMap.get(node.id);
          if (!note) return node;

          // 仅更新 data，保留 position 和 measured 尺寸
          return {
            ...node,
            data: {
              noteId: note.id,
              title: note.title,
              excerpt: note.excerpt,
              color: note.color,
              isSelected: note.id === selectedNoteId,
            },
          };
        });
      }

      // 完整重建路径：有增删操作
      const currentNodesMap = new Map(currentNodes.map((n) => [n.id, n]));

      return notes.map((note, index) => {
        const currentNode = currentNodesMap.get(note.id);

        // 位置优先级：
        // 1. 保留当前画布位置（用户正在拖拽的状态）
        // 2. 使用数据库保存的位置
        // 3. 使用网格布局计算初始位置
        let position = { x: 0, y: 0 };
        if (currentNode) {
          position = currentNode.position;
        } else if (note.canvasX != null && note.canvasY != null) {
          position = { x: note.canvasX, y: note.canvasY };
        } else {
          position = calculateInitialPosition(index);
        }

        // 尺寸优先级：
        // 1. 保留当前画布尺寸（用户正在调整的状态）
        // 2. 使用数据库保存的尺寸
        // 3. 使用默认尺寸
        const width = currentNode?.measured?.width ?? note.canvasWidth ?? NODE_WIDTH;
        const height = currentNode?.measured?.height ?? note.canvasHeight ?? NODE_HEIGHT;

        const nodeData: NoteNodeData = {
          noteId: note.id,
          title: note.title,
          excerpt: note.excerpt,
          color: note.color,
          isSelected: note.id === selectedNoteId,
        };

        return {
          id: note.id,
          type: 'note',
          position,
          data: nodeData,
          width,
          height,
        };
      });
    });

    prevNotesRef.current = notes;
  }, [notes, selectedNoteId, setNodes]);

  // 列表选中变化时，飞入画布对应节点
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (selectedNoteId) {
      // 稍微延迟一点，确保节点已经渲染
      setTimeout(() => {
        const node = getNode(selectedNoteId);
        if (node) {
          setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
            zoom: 1.16,
            duration: 500,
          });
        }
      }, 50);
    }
  }, [selectedNoteId, getNode, setCenter]);

  // 节点点击：选中便签
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNote(node.id);
    },
    [setSelectedNote],
  );

  // 新建便签（在画布中心创建）

  // 适应画布
  const handleFitView = useCallback(() => {
    fitView({
      padding: 0.2,
      duration: 500,
      maxZoom: 1.5,
      minZoom: 0.5,
    });
  }, [fitView]);

  // 自动排列
  const handleAutoLayout = useCallback(async () => {
    // 获取默认尺寸
    let defaultWidth = NODE_WIDTH;
    let defaultHeight = NODE_HEIGHT;

    try {
      const config = await window.ipcRenderer?.invoke('config:getDefaultFloatingWindowSize');
      if (config) {
        defaultWidth = config.width || NODE_WIDTH;
        defaultHeight = config.height || NODE_HEIGHT;
      }
    } catch (error) {
      console.error('Failed to load default size:', error);
    }

    // 批量更新数据库中的位置和尺寸
    const updatePromises = nodes.map((node, index) => {
      const position = calculateInitialPosition(index);
      return window.storage.updateNote(node.id, {
        canvasX: position.x,
        canvasY: position.y,
        canvasWidth: defaultWidth,
        canvasHeight: defaultHeight,
      });
    });

    await Promise.all(updatePromises);

    // 更新节点（直接设置新的位置和尺寸）
    const layoutedNodes = nodes.map((node, index) => ({
      ...node,
      position: calculateInitialPosition(index),
      width: defaultWidth,
      height: defaultHeight,
      measured: {
        width: defaultWidth,
        height: defaultHeight,
      },
    }));

    setNodes(layoutedNodes);
  }, [nodes, setNodes]);

  // 节点拖拽/调整尺寸结束：批量保存位置和尺寸
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodesChange(changes as any);

      // 收集需要保存的变更
      const updates: Array<{
        id: string;
        patch: { canvasX?: number; canvasY?: number; canvasWidth?: number; canvasHeight?: number };
      }> = [];

      changes.forEach((change) => {
        // 保存位置变化
        if (change.type === 'position' && change.dragging === false && change.position) {
          updates.push({
            id: change.id,
            patch: {
              canvasX: change.position.x,
              canvasY: change.position.y,
            },
          });
        }

        // 保存尺寸变化
        if (change.type === 'dimensions' && change.resizing === false && change.dimensions) {
          updates.push({
            id: change.id,
            patch: {
              canvasWidth: change.dimensions.width,
              canvasHeight: change.dimensions.height,
            },
          });
        }
      });

      // 批量更新数据库（避免多次调用）
      updates.forEach(({ id, patch }) => {
        window.storage.updateNote(id, patch);
      });
    },
    [onNodesChange],
  );

  // 处理节点选中变化
  const handleSelectionChange = useCallback(
    async (selection: { nodes: Node[] }) => {
      const selectedNodesList = selection.nodes;

      // 使用 Promise.all 并发获取所有选中便签的完整内容
      const notePromises = selectedNodesList.map(async (node) => {
        const noteInStore = notes.find((n) => n.id === node.id);
        if (noteInStore) {
          // 优先使用缓存
          if (noteCacheRef.current.has(node.id)) {
            return noteCacheRef.current.get(node.id)!;
          }

          try {
            // 重新获取完整的便签数据（包含 content）
            const fullNote = await window.storage.getNote(node.id);
            const textContent = extractTipTapText(fullNote.content);
            const noteData = {
              id: fullNote.id,
              title: fullNote.title || '无标题',
              content: textContent,
              color: fullNote.color,
            };
            // 缓存结果
            noteCacheRef.current.set(node.id, noteData);
            return noteData;
          } catch (err) {
            console.error('[Canvas] Failed to load note:', err);
            message.error(`加载便签"${noteInStore.title}"失败`);
            return null;
          }
        }
        return null;
      });

      const newSelectedNotes = (await Promise.all(notePromises)).filter(Boolean) as Array<{
        id: string;
        title: string;
        content: string;
        color?: string;
      }>;

      setSelectedNotes(newSelectedNotes);
    },
    [notes],
  );

  return (
    <div className="canvas-tab">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onSelectionChange={handleSelectionChange}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
        nodeDragThreshold={1}
        // 排除编辑器区域的拖动（使用 noDragClassName）
        noDragClassName="nodrag"
        // 允许节点内部区域使用滚轮进行内容滚动
        zoomOnScroll={true}
        panOnScroll={false}
        // 排除带有 nowheel 类名的元素，不进行缩放拦截
        noWheelClassName="nowheel"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* Controls 组件，内置小地图和自动排列按钮 */}
        <Controls position="bottom-right" showInteractive={false}>
          <Tooltip title="适应画布" placement="left">
            <button className="react-flow__controls-button" onClick={handleFitView}>
              <FullscreenOutlined />
            </button>
          </Tooltip>
          <Tooltip title="自动排列" placement="left">
            <button className="react-flow__controls-button" onClick={handleAutoLayout}>
              <LayoutOutlined />
            </button>
          </Tooltip>
          <Tooltip title={showMiniMap ? '隐藏小地图' : '显示小地图'} placement="left">
            <button
              className={`react-flow__controls-button ${showMiniMap ? 'react-flow__controls-button--active' : ''}`}
              onClick={() => setShowMiniMap(!showMiniMap)}
            >
              <EnvironmentOutlined />
            </button>
          </Tooltip>
        </Controls>

        {/* 小地图 - 条件渲染 */}
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              const bgColor = node.data.color as NoteColorId;
              return NOTE_COLOR_HEX_MAP[bgColor] || '#ffffff';
            }}
            nodeStrokeColor={(node) => {
              return node.data.isSelected ? '#1677ff' : '#e8e8e8';
            }}
            nodeStrokeWidth={3}
            nodeBorderRadius={8}
            zoomable
            pannable
            position="bottom-right"
            style={{
              backgroundColor: '#fafafa',
              border: '1px solid #e8e8e8',
              borderRadius: '8px',
              marginBottom: '140px',
              marginRight: '10px',
            }}
            maskColor="rgba(0, 0, 0, 0.05)"
          />
        )}

        {/* 底部中央 AI 输入框 */}
        <Panel position="bottom-center">
          <div
            style={{
              width: '600px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* AI回复显示区域 */}
            {showAiResponse && (
              <div className="canvas-panel-card canvas-ai-response">
                {/* 内容区域 - 可滚动 */}
                <div ref={aiResponseRef} className="canvas-ai-response-content">
                  {/* 加载状态 */}
                  {isStreaming && !aiResponse && (
                    <div style={{ color: '#999', fontSize: '14px' }}>
                      <span>AI 思考中...</span>
                    </div>
                  )}

                  {/* Markdown渲染 */}
                  {aiResponse && (
                    <MarkdownRenderer
                      content={aiResponse}
                      streaming={
                        isStreaming ? { hasNextChunk: true, enableAnimation: true } : undefined
                      }
                    />
                  )}
                </div>

                {/* 操作按钮区域 - 固定在底部 */}
                {aiResponse && (
                  <div className="canvas-ai-response-actions">
                    <Space>
                      <Button
                        size="small"
                        icon={<SaveOutlined />}
                        onClick={handleSaveAiResponse}
                        disabled={isStreaming}
                      >
                        保存
                      </Button>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={handleCopyAiResponse}
                        disabled={isStreaming}
                      >
                        复制
                      </Button>
                      <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => {
                          setShowAiResponse(false);
                          clearChat();
                        }}
                      >
                        关闭
                      </Button>
                    </Space>
                  </div>
                )}
              </div>
            )}

            {/* 输入框容器 */}
            <div className="canvas-panel-card">
              <ChatInput
                isLoading={isStreaming}
                onSend={handleSendMessage}
                onAbort={abort}
                selectedNotes={selectedNotes}
                onRemoveNote={handleRemoveNote}
                providerConfig={{
                  config,
                  options: providerOptions,
                  currentId: currentProviderId,
                  isSwitching,
                  onSwitch: switchProvider,
                }}
                knowledgeBase={{
                  enabled: false,
                  inUse: false,
                  onToggle: () => {},
                }}
                noteReference={{
                  items: noteItems,
                  onSelect: handleNoteSelect,
                }}
                autoSize={{ minRows: 1, maxRows: 6 }}
              />
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

/**
 * CanvasTab 主组件
 */
export const CanvasTab: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};

export default CanvasTab;
