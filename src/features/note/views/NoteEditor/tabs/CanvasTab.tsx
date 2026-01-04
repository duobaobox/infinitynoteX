/**
 * CanvasTab - 无限画布视图
 *
 * 【组件职责】
 * - 以画布形式展示当前文件夹下的所有便签
 * - 支持拖拽、缩放、平移
 * - 与左侧列表双向联动
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeChange,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkspaceStore } from '../../../../../store/workspaceStore';
import NoteNode, { type NoteNodeData } from './NoteNode';
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

  const { setCenter, getNode } = useReactFlow();
  const isInitialMount = useRef(true);
  const prevNotesRef = useRef(notes);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NoteNodeData>>([]);

  // 统一处理节点更新：notes 变化或 selectedNoteId 变化
  useEffect(() => {
    const prevNotes = prevNotesRef.current;
    const notesChanged = notes !== prevNotes;

    setNodes((currentNodes) => {
      // 如果只是选中状态变化，快速更新 isSelected
      if (!notesChanged && currentNodes.length === notes.length) {
        return currentNodes.map((node) => ({
          ...node,
          data: { ...node.data, isSelected: node.id === selectedNoteId },
        }));
      }

      // notes 发生变化，需要完整更新
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

  return (
    <div className="canvas-tab">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
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
        <Controls />
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
