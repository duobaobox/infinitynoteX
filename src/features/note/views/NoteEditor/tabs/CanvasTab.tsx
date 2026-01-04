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

  // 将便签数据转换为 ReactFlow 节点
  const initialNodes = useMemo(() => {
    return notes.map((note, index) => {
      // 如果有保存的坐标，使用保存的；否则使用网格布局
      const position =
        note.canvasX != null && note.canvasY != null
          ? { x: note.canvasX, y: note.canvasY }
          : calculateInitialPosition(index);

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
        width: note.canvasWidth ?? NODE_WIDTH,
        height: note.canvasHeight ?? NODE_HEIGHT,
      };
    });
  }, [notes, selectedNoteId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // 当 notes 变化时，合并更新节点数据，但保留当前位置
  useEffect(() => {
    setNodes((nds) => {
      // 创建当前节点的映射，方便查找
      const currentNodesMap = new Map(nds.map((n) => [n.id, n]));

      return notes.map((note, index) => {
        const currentNode = currentNodesMap.get(note.id);

        // 计算目标位置：
        // 1. 如果当前画布已有该节点，优先使用当前画布的位置（避免拖拽时跳变）
        // 2. 如果是新节点，且数据库有保存位置，使用数据库位置
        // 3. 否则使用网格布局计算初始位置
        let position = { x: 0, y: 0 };

        if (currentNode) {
          position = currentNode.position;
        } else if (note.canvasX != null && note.canvasY != null) {
          position = { x: note.canvasX, y: note.canvasY };
        } else {
          position = calculateInitialPosition(index);
        }

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
          width: currentNode?.width ?? note.canvasWidth ?? NODE_WIDTH,
          height: currentNode?.height ?? note.canvasHeight ?? NODE_HEIGHT,
        };
      });
    });
  }, [notes, selectedNoteId, setNodes]);

  // FIXME: 上面的 useEffect 已经包含了 selectedNoteId 的依赖，这会导致每次选中都会重新计算所有节点
  // 虽然逻辑上是对的（更新 isSelected），但如果 notes 列表很大，可能会有性能问题。
  // 不过考虑到这是个简单的便签应用，目前这样写更健壮，不容易出 bug。
  // 关键在于：我们在 map 时使用了 currentNode.position，这样就保留了 ReactFlow 内部状态中的位置。

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
            zoom: 1,
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

  // 节点拖拽结束：保存位置和尺寸
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodesChange(changes as any);

      // 处理拖拽结束事件
      changes.forEach((change) => {
        // 保存位置变化
        if (change.type === 'position' && change.dragging === false && change.position) {
          const { id, position } = change;
          window.storage.updateNote(id, {
            canvasX: position.x,
            canvasY: position.y,
          });
        }

        // 保存尺寸变化
        if (change.type === 'dimensions' && change.resizing === false && change.dimensions) {
          const { id, dimensions } = change;
          window.storage.updateNote(id, {
            canvasWidth: dimensions.width,
            canvasHeight: dimensions.height,
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
        nodeDragThreshold={1}
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
