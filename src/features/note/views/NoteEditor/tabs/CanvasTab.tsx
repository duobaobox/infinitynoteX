/**
 * CanvasTab - 无限画布视图
 *
 * 【组件职责】
 * - 以画布形式展示当前文件夹下的所有便签
 * - 支持拖拽、缩放、平移
 * - 与左侧列表双向联动
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

// 注册自定义节点类型
const nodeTypes = {
  note: NoteNode,
};

// 网格布局参数
const GRID_COLS = 4;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const GAP_X = 30;
const GAP_Y = 30;

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

  // 将便签数据转换为 ReactFlow 节点
  const initialNodes = useMemo(() => {
    return notes.map((note, index) => {
      // 如果有保存的坐标，使用保存的；否则使用网格布局
      const position =
        note.canvasX != null && note.canvasY != null
          ? { x: note.canvasX, y: note.canvasY }
          : calculateInitialPosition(index);

      const nodeData: NoteNodeData = {
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
      };
    });
  }, [notes, selectedNoteId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // 当 notes 变化时更新节点
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // 列表选中变化时，飞入画布对应节点
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (selectedNoteId) {
      const node = getNode(selectedNoteId);
      if (node) {
        setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
          zoom: 1,
          duration: 500,
        });
      }
    }
  }, [selectedNoteId, getNode, setCenter]);

  // 节点点击：选中便签
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNote(node.id);
    },
    [setSelectedNote],
  );

  // 节点拖拽结束：保存位置
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodesChange(changes as any);

      // 处理拖拽结束事件
      changes.forEach((change) => {
        if (change.type === 'position' && change.dragging === false && change.position) {
          const { id, position } = change;
          // 保存到数据库
          window.storage.updateNote(id, {
            canvasX: position.x,
            canvasY: position.y,
          });
        }
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
