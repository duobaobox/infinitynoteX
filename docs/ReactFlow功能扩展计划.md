# React Flow 功能扩展计划

> 基于当前画布实现的深度分析与功能扩展建议
>
> 创建日期：2026年1月5日

## 📊 一、当前实现评估

### 1.1 已使用的组件和功能

| 组件/功能           | 使用情况  | 用途说明                       |
| ------------------- | --------- | ------------------------------ |
| `ReactFlow`         | ✅ 已使用 | 画布主容器，核心组件           |
| `Background`        | ✅ 已使用 | 网格背景（点状，gap=20）       |
| `Controls`          | ✅ 已使用 | 缩放控制器（右下角）           |
| `NodeResizer`       | ✅ 已使用 | 节点尺寸调整功能               |
| `Handle`            | ✅ 已预留 | 连接点（Top/Bottom），暂未连线 |
| `useNodesState`     | ✅ 已使用 | 节点状态管理 Hook              |
| `useReactFlow`      | ✅ 已使用 | 核心 API（setCenter, getNode） |
| `ReactFlowProvider` | ✅ 已使用 | 上下文提供者                   |

### 1.2 当前实现的特性

**✅ 核心功能**

- 无限画布拖拽和平移
- 节点拖拽和尺寸调整
- 位置和尺寸持久化存储
- 选中状态管理
- 聚焦动画（zoom: 1.16, duration: 500ms）
- 网格布局算法（3列，400x400节点）
- 编辑器区域滚轮隔离（nowheel className）

**✅ 性能优化**

- 节点类型在组件外定义，避免重复创建
- 智能节点更新：只有 selectedNoteId 变化时快速更新
- 懒加载 TipTap 编辑器
- 防抖保存（500ms）

### 1.3 现有问题和改进点

1. **缺少全局导航** - 便签多时难以快速定位
2. **无快捷操作入口** - 需要返回列表进行操作
3. **未利用 Handle 连接点** - 已预留但未实现关联功能
4. **缺少多选和批量操作** - 只能单个操作节点
5. **无视口状态保存** - 每次打开都需要重新定位

---

## 🚀 二、推荐功能扩展

### 2.1 高优先级功能（立即实现）

#### 功能 1：NodeToolbar - 节点工具栏

**价值：** ⭐⭐⭐⭐⭐  
**实现难度：** 简单  
**预计工时：** 2小时

**功能说明：**
选中节点时在上方显示快捷操作按钮，提供删除、复制、颜色选择等功能。

**实现代码：**

```tsx
// 在 NoteNode.tsx 中添加
import { NodeToolbar } from '@xyflow/react';
import { DeleteOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { Space, Button, Tooltip } from 'antd';

<NodeToolbar isVisible={isSelected} position={Position.Top}>
  <Space
    size="small"
    style={{
      background: '#fff',
      padding: '4px 8px',
      borderRadius: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}
  >
    <Tooltip title="删除便签">
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={handleDelete} />
    </Tooltip>
    <Tooltip title="复制便签">
      <Button size="small" type="text" icon={<CopyOutlined />} onClick={handleCopy} />
    </Tooltip>
    <Tooltip title="创建链接">
      <Button size="small" type="text" icon={<LinkOutlined />} onClick={handleCreateLink} />
    </Tooltip>
    <ColorPicker value={bgColor} onChange={handleColorChange} size="small" showText={false} />
  </Space>
</NodeToolbar>;
```

**需要实现的回调函数：**

```tsx
const handleDelete = useCallback(() => {
  Modal.confirm({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除这个便签吗？',
    onOk: () => window.storage.deleteNote(data.noteId),
  });
}, [data.noteId]);

const handleCopy = useCallback(async () => {
  const note = await window.storage.getNote(data.noteId);
  const newNote = await window.storage.createNote({
    ...note,
    title: `${note.title} (副本)`,
    canvasX: note.canvasX ? note.canvasX + 50 : undefined,
    canvasY: note.canvasY ? note.canvasY + 50 : undefined,
  });
  message.success('已复制便签');
}, [data.noteId]);
```

---

#### 功能 2：Panel - 画布工具栏

**价值：** ⭐⭐⭐⭐⭐  
**实现难度：** 简单  
**预计工时：** 3小时

**功能说明：**
在画布顶部添加浮动工具栏，提供新建便签、自动布局、视图控制等功能。

**实现代码：**

```tsx
// 在 CanvasTab.tsx 中添加
import { Panel } from '@xyflow/react';
import { PlusOutlined, LayoutOutlined, ZoomInOutlined, UnorderedListOutlined } from '@ant-design/icons';

// 左上角工具栏
<Panel position="top-left">
  <Space style={{ background: '#fff', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={handleCreateNote}
    >
      新建便签
    </Button>
    <Select
      value={layoutType}
      onChange={handleLayoutChange}
      style={{ width: 120 }}
      placeholder="布局方式"
    >
      <Option value="grid">网格布局</Option>
      <Option value="cascade">层叠布局</Option>
      <Option value="tree">树形布局</Option>
    </Select>
    <Button
      icon={<LayoutOutlined />}
      onClick={handleAutoLayout}
    >
      自动排列
    </Button>
  </Space>
</Panel>

// 右上角信息栏
<Panel position="top-right">
  <Space style={{ background: '#fff', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
    <Badge count={nodes.length} overflowCount={999} color="#1677ff">
      <UnorderedListOutlined style={{ fontSize: 16 }} />
    </Badge>
    <Button
      icon={<ZoomInOutlined />}
      onClick={handleFitView}
    >
      适应画布
    </Button>
  </Space>
</Panel>
```

**核心逻辑实现：**

```tsx
// 新建便签（在画布中心创建）
const handleCreateNote = useCallback(async () => {
  const { x, y, zoom } = getViewport();
  const centerX = -x / zoom + window.innerWidth / 2 / zoom;
  const centerY = -y / zoom + window.innerHeight / 2 / zoom;

  const newNote = await window.storage.createNote({
    title: '新便签',
    content: { type: 'doc', content: [] },
    canvasX: centerX - NODE_WIDTH / 2,
    canvasY: centerY - NODE_HEIGHT / 2,
  });

  setSelectedNote(newNote.id);
}, [getViewport, setSelectedNote]);

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
const handleAutoLayout = useCallback(() => {
  const layoutedNodes = nodes.map((node, index) => ({
    ...node,
    position: calculateInitialPosition(index),
  }));

  setNodes(layoutedNodes);

  // 批量保存位置
  layoutedNodes.forEach((node) => {
    window.storage.updateNote(node.id, {
      canvasX: node.position.x,
      canvasY: node.position.y,
    });
  });

  message.success('已重新排列所有便签');
}, [nodes, setNodes]);
```

---

#### 功能 3：MiniMap - 小地图

**价值：** ⭐⭐⭐⭐  
**实现难度：** 极简单  
**预计工时：** 0.5小时

**功能说明：**
在画布右下角显示全局缩略图，便于在大量便签中快速导航。

**实现代码：**

```tsx
import { MiniMap } from '@xyflow/react';

<MiniMap
  nodeColor={(node) => {
    const bgColor = node.data.color;
    return colorMap[bgColor] || '#ffffff';
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
  }}
  maskColor="rgba(0, 0, 0, 0.05)"
/>;
```

---

#### 功能 4：SelectionMode - 框选模式

**价值：** ⭐⭐⭐⭐  
**实现难度：** 简单  
**预计工时：** 2小时

**功能说明：**
支持框选多个便签，进行批量删除、移动、颜色修改等操作。

**实现代码：**

```tsx
import { SelectionMode } from '@xyflow/react';

<ReactFlow
  // ... 其他 props
  selectionMode={SelectionMode.Partial}
  multiSelectionKeyCode="Control"
  selectionOnDrag={true}
  panOnDrag={[1, 2]} // 只允许鼠标中键和右键拖动画布
  onSelectionChange={handleSelectionChange}
/>;

// 批量操作栏
{
  selectedNodes.length > 1 && (
    <Panel position="bottom-center">
      <Space
        style={{ background: '#1677ff', color: '#fff', padding: '8px 16px', borderRadius: '8px' }}
      >
        <span>已选中 {selectedNodes.length} 个便签</span>
        <Button size="small" type="primary" ghost onClick={handleBatchDelete}>
          批量删除
        </Button>
        <ColorPicker size="small" onChange={handleBatchColor} />
        <Button
          size="small"
          type="text"
          style={{ color: '#fff' }}
          onClick={() => setNodes((ns) => ns.map((n) => ({ ...n, selected: false })))}
        >
          取消选择
        </Button>
      </Space>
    </Panel>
  );
}
```

---

### 2.2 中优先级功能（近期实现）

#### 功能 5：Edges - 便签关联连线

**价值：** ⭐⭐⭐⭐  
**实现难度：** 中等  
**预计工时：** 8小时

**功能说明：**
支持便签之间建立可视化关联，如引用关系、前后关系等。适合实现双链笔记功能。

**数据结构设计：**

```typescript
interface NoteLink {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  type: 'reference' | 'temporal' | 'hierarchical'; // 引用/时间/层级关系
  label?: string;
  createdAt: number;
}
```

**实现代码：**

```tsx
import { useEdgesState, MarkerType, EdgeProps, getBezierPath } from '@xyflow/react';

// 自定义边样式
const ReferenceEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={2}
        stroke="#1677ff"
        fill="none"
      />
      {data?.label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize={12}
          fill="#666"
          className="react-flow__edge-text"
        >
          {data.label}
        </text>
      )}
    </>
  );
};

const edgeTypes = {
  reference: ReferenceEdge,
};

// 在 ReactFlow 中使用
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

<ReactFlow
  edges={edges}
  edgeTypes={edgeTypes}
  onEdgesChange={onEdgesChange}
  onConnect={handleConnect}
  defaultEdgeOptions={{
    type: 'reference',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#1677ff' },
  }}
/>;
```

**连接处理：**

```tsx
const handleConnect = useCallback(
  (params) => {
    // 保存连接关系到数据库
    window.storage.createNoteLink({
      sourceNoteId: params.source,
      targetNoteId: params.target,
      type: 'reference',
    });

    setEdges((eds) => addEdge(params, eds));
  },
  [setEdges],
);
```

---

#### 功能 6：键盘快捷键

**价值：** ⭐⭐⭐⭐  
**实现难度：** 简单  
**预计工时：** 2小时

**实现代码：**

```tsx
import { useKeyPress } from '@xyflow/react';

// Delete 键删除选中节点
useKeyPress('Delete', () => {
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length === 0) return;

  Modal.confirm({
    title: `确认删除 ${selectedNodes.length} 个便签？`,
    content: '删除后无法恢复',
    onOk: async () => {
      await Promise.all(selectedNodes.map((n) => window.storage.deleteNote(n.id)));
      message.success('已删除');
    },
  });
});

// Ctrl+A 全选
useKeyPress(['Control', 'a'], (e) => {
  e.preventDefault();
  setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
});

// Ctrl+C 复制
useKeyPress(['Control', 'c'], () => {
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length > 0) {
    clipboard.current = selectedNodes;
    message.success('已复制到剪贴板');
  }
});

// Ctrl+V 粘贴
useKeyPress(['Control', 'v'], async () => {
  if (clipboard.current.length === 0) return;

  const { x, y, zoom } = getViewport();
  const centerX = -x / zoom + window.innerWidth / 2 / zoom;
  const centerY = -y / zoom + window.innerHeight / 2 / zoom;

  // 批量创建副本
  const newNotes = await Promise.all(
    clipboard.current.map((node, index) =>
      window.storage.createNote({
        ...node.data,
        title: `${node.data.title} (副本)`,
        canvasX: centerX + index * 50,
        canvasY: centerY + index * 50,
      }),
    ),
  );

  message.success(`已粘贴 ${newNotes.length} 个便签`);
});

// Escape 取消选择
useKeyPress('Escape', () => {
  setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
});

// F 键适应画布
useKeyPress('f', () => {
  fitView({ duration: 500 });
});

// 数字键 1-6 切换颜色
useKeyPress('1', () => applyColorToSelected('ffffff'));
useKeyPress('2', () => applyColorToSelected('bae0ff'));
useKeyPress('3', () => applyColorToSelected('d9f7be'));
useKeyPress('4', () => applyColorToSelected('ffd6e7'));
useKeyPress('5', () => applyColorToSelected('d6e4ff'));
useKeyPress('6', () => applyColorToSelected('ffd666'));
```

---

#### 功能 7：右键菜单

**价值：** ⭐⭐⭐  
**实现难度：** 中等  
**预计工时：** 4小时

**实现代码：**

```tsx
import { Dropdown, Menu } from 'antd';

const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  nodeId?: string;
  visible: boolean;
} | null>(null);

const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
  event.preventDefault();
  setContextMenu({
    x: event.clientX,
    y: event.clientY,
    nodeId: node.id,
    visible: true,
  });
}, []);

const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
  event.preventDefault();
  setContextMenu({
    x: event.clientX,
    y: event.clientY,
    visible: true,
  });
}, []);

const menuItems = contextMenu?.nodeId
  ? [
      { key: 'open', label: '打开编辑', icon: <EditOutlined /> },
      { key: 'copy', label: '复制', icon: <CopyOutlined /> },
      { type: 'divider' },
      { key: 'color', label: '修改颜色', icon: <BgColorsOutlined />, children: colorOptions },
      { type: 'divider' },
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ]
  : [
      { key: 'create', label: '新建便签', icon: <PlusOutlined /> },
      { key: 'paste', label: '粘贴', icon: <FileAddOutlined />, disabled: clipboard.length === 0 },
      { type: 'divider' },
      { key: 'layout', label: '自动排列', icon: <LayoutOutlined /> },
      { key: 'fitView', label: '适应画布', icon: <ZoomInOutlined /> },
    ];

<ReactFlow onNodeContextMenu={handleNodeContextMenu} onPaneContextMenu={handlePaneContextMenu} />;

{
  contextMenu?.visible && (
    <div
      style={{
        position: 'fixed',
        top: contextMenu.y,
        left: contextMenu.x,
        zIndex: 9999,
      }}
      onClick={() => setContextMenu(null)}
    >
      <Menu
        items={menuItems}
        onClick={handleMenuClick}
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      />
    </div>
  );
}
```

---

#### 功能 8：自动布局算法

**价值：** ⭐⭐⭐⭐  
**实现难度：** 中等  
**预计工时：** 6小时

**依赖安装：**

```bash
npm install dagre @types/dagre
npm install elkjs
```

**实现代码：**

```tsx
import dagre from 'dagre';

// 树形布局（dagre）
const autoLayoutTree = useCallback(
  (direction: 'TB' | 'LR' = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: 50,
      ranksep: 100,
    });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: node.width ?? NODE_WIDTH,
        height: node.height ?? NODE_HEIGHT,
      });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      const pos = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: pos.x - (node.width ?? NODE_WIDTH) / 2,
          y: pos.y - (node.height ?? NODE_HEIGHT) / 2,
        },
      };
    });

    setNodes(layoutedNodes);
    savePositions(layoutedNodes);
  },
  [nodes, edges, setNodes],
);

// 力导向布局（简单版）
const autoLayoutForce = useCallback(() => {
  // 使用简单的物理模拟
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const radius = 400;

  const layoutedNodes = nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
    };
  });

  setNodes(layoutedNodes);
  savePositions(layoutedNodes);
}, [nodes, setNodes]);

// 层叠布局（cascade）
const autoLayoutCascade = useCallback(() => {
  const offsetX = 30;
  const offsetY = 30;

  const layoutedNodes = nodes.map((node, index) => ({
    ...node,
    position: {
      x: 100 + index * offsetX,
      y: 100 + index * offsetY,
    },
  }));

  setNodes(layoutedNodes);
  savePositions(layoutedNodes);
}, [nodes, setNodes]);
```

---

### 2.3 低优先级功能（长期规划）

#### 功能 9：视口状态保存

**价值：** ⭐⭐⭐  
**实现难度：** 简单  
**预计工时：** 1小时

**实现代码：**

```tsx
import { useOnViewportChange } from '@xyflow/react';

// 保存视口状态
useOnViewportChange({
  onChange: (viewport) => {
    // 使用 localStorage 或数据库保存
    const folderId = useWorkspaceStore.getState().currentFolderId;
    localStorage.setItem(`canvas-viewport-${folderId}`, JSON.stringify(viewport));
  },
});

// 恢复视口状态
useEffect(() => {
  const folderId = useWorkspaceStore.getState().currentFolderId;
  const savedViewport = localStorage.getItem(`canvas-viewport-${folderId}`);

  if (savedViewport) {
    const viewport = JSON.parse(savedViewport);
    setViewport(viewport, { duration: 300 });
  }
}, [currentFolderId]);
```

---

#### 功能 10：节点分组

**价值：** ⭐⭐⭐  
**实现难度：** 高  
**预计工时：** 12小时

**功能说明：**
支持将多个便签放入一个可折叠的组内，类似文件夹功能。

**数据结构：**

```typescript
interface GroupNode {
  id: string;
  type: 'group';
  position: { x: number; y: number };
  data: {
    label: string;
    color?: string;
    collapsed?: boolean;
  };
  style: {
    width: number;
    height: number;
    backgroundColor: string;
  };
}
```

**实现代码：**

```tsx
const GroupNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div className="group-node">
      <div className="group-header">
        {data.collapsed ? <FolderOutlined /> : <FolderOpenOutlined />}
        <span>{data.label}</span>
      </div>
      <div className="group-content">{/* 子节点由 React Flow 自动渲染 */}</div>
    </div>
  );
};

const nodeTypes = {
  note: NoteNode,
  group: GroupNode,
};

// 节点父子关系
const nodesWithParent = nodes.map((node) => ({
  ...node,
  parentNode: node.data.groupId, // 设置父节点
  extent: 'parent', // 限制在父节点内
}));
```

---

## 📋 三、实施计划

### 3.1 第一阶段（Week 1）- 基础体验提升

**目标：** 提升日常操作效率

| 功能          | 优先级 | 预计工时 | 完成标准                         |
| ------------- | ------ | -------- | -------------------------------- |
| NodeToolbar   | P0     | 2h       | 选中节点时显示删除/复制/颜色工具 |
| Panel 工具栏  | P0     | 3h       | 顶部显示新建、布局、适应画布按钮 |
| MiniMap       | P0     | 0.5h     | 右下角显示小地图，支持点击跳转   |
| SelectionMode | P0     | 2h       | 支持框选和批量操作               |

**验收标准：**

- [ ] 单个便签快捷操作完整
- [ ] 画布顶部工具栏美观实用
- [ ] 小地图正确显示节点颜色和选中状态
- [ ] 框选多个便签后显示批量操作栏

---

### 3.2 第二阶段（Week 2）- 高级功能

**目标：** 增强便签关联和操作效率

| 功能       | 优先级 | 预计工时 | 完成标准                    |
| ---------- | ------ | -------- | --------------------------- |
| 键盘快捷键 | P1     | 2h       | 支持 Delete/Ctrl+C/V/A/F 等 |
| 右键菜单   | P1     | 4h       | 节点和画布右键菜单完整      |
| 自动布局   | P1     | 6h       | 网格/树形/层叠/力导向布局   |
| Edges 连线 | P1     | 8h       | 支持手动连线和显示引用关系  |

**验收标准：**

- [ ] 键盘快捷键响应正确
- [ ] 右键菜单功能完整
- [ ] 至少实现 3 种布局算法
- [ ] 连线功能可用，数据持久化

---

### 3.3 第三阶段（Week 3+）- 优化完善

**目标：** 提升用户体验细节

| 功能         | 优先级 | 预计工时 | 完成标准                 |
| ------------ | ------ | -------- | ------------------------ |
| 视口状态保存 | P2     | 1h       | 记住每个文件夹的视口位置 |
| 节点分组     | P2     | 12h      | 支持创建组、拖入拖出节点 |
| 性能优化     | P2     | 4h       | 节点数 > 100 时优化渲染  |
| 动画优化     | P2     | 2h       | 平滑的过渡动画           |

---

## 🎯 四、技术要点

### 4.1 性能优化建议

**1. 节点虚拟化（当节点 > 100 时）**

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// 只渲染视口内的节点
const visibleNodes = useMemo(() => {
  const { x, y, zoom } = viewport;
  const viewportBounds = {
    left: -x / zoom,
    top: -y / zoom,
    right: (-x + window.innerWidth) / zoom,
    bottom: (-y + window.innerHeight) / zoom,
  };

  return nodes.filter((node) => {
    return isNodeInViewport(node, viewportBounds);
  });
}, [nodes, viewport]);
```

**2. 防止不必要的重渲染**

```tsx
// 使用 memo 包裹节点组件
export default memo(NoteNode, (prev, next) => {
  return (
    prev.data.noteId === next.data.noteId &&
    prev.data.isSelected === next.data.isSelected &&
    prev.data.color === next.data.color
  );
});
```

**3. 批量更新优化**

```tsx
// 使用 unstable_batchedUpdates 批量更新
import { unstable_batchedUpdates } from 'react-dom';

unstable_batchedUpdates(() => {
  setNodes(newNodes);
  setEdges(newEdges);
  setSelectedNote(noteId);
});
```

### 4.2 数据持久化策略

**1. 防抖保存**

```tsx
const debouncedSavePositions = useMemo(
  () =>
    debounce((nodes) => {
      const updates = nodes.map((node) => ({
        id: node.id,
        canvasX: node.position.x,
        canvasY: node.position.y,
      }));
      window.storage.batchUpdateNotes(updates);
    }, 1000),
  [],
);
```

**2. 离线优先**

```tsx
// 先更新本地状态，后台异步同步
const updateNodePosition = (nodeId, position) => {
  // 立即更新 UI
  setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, position } : n)));

  // 异步保存到数据库
  queueMicrotask(() => {
    window.storage.updateNote(nodeId, {
      canvasX: position.x,
      canvasY: position.y,
    });
  });
};
```

### 4.3 样式定制

**自定义主题色**

```css
/* CanvasTab.css */
.react-flow__node.selected {
  box-shadow: 0 0 0 2px #1677ff;
}

.react-flow__edge.selected {
  stroke: #1677ff;
}

.react-flow__minimap-mask {
  fill: rgba(22, 119, 255, 0.1);
}

.react-flow__controls-button {
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
}

.react-flow__controls-button:hover {
  background: #f5f5f5;
  border-color: #1677ff;
}
```

---

## 📊 五、预期效果

### 5.1 用户体验提升

| 指标         | 当前         | 优化后         | 提升幅度 |
| ------------ | ------------ | -------------- | -------- |
| 便签操作效率 | 需返回列表   | 画布内直接操作 | +80%     |
| 导航定位速度 | 手动拖动查找 | 小地图点击跳转 | +90%     |
| 批量操作能力 | 不支持       | 框选批量处理   | +100%    |
| 关联可视化   | 无           | 连线显示关系   | +100%    |
| 布局美观度   | 手动调整     | 自动布局算法   | +70%     |

### 5.2 开发成本评估

**总预计工时：** 47.5 小时  
**建议开发周期：** 3周  
**开发人力：** 1人全职

**风险点：**

1. Edges 连线功能涉及数据结构变更，需要数据库迁移
2. 自动布局算法需要调优参数
3. 性能优化需要大量数据测试

---

## 🔧 六、技术选型补充

### 6.1 推荐库

| 库名                      | 用途         | 是否必需 |
| ------------------------- | ------------ | -------- |
| `dagre`                   | 树形布局算法 | 可选     |
| `elkjs`                   | 高级布局引擎 | 可选     |
| `@tanstack/react-virtual` | 节点虚拟化   | 可选     |
| `react-use`               | 实用 Hooks   | 推荐     |

### 6.2 性能监控

```tsx
// 添加性能监控
useEffect(() => {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    if (endTime - startTime > 16) {
      // 超过一帧时间
      console.warn(`Canvas render took ${endTime - startTime}ms`);
    }
  };
});
```

---

## 📝 七、总结

本报告基于当前 React Flow 实现，提出了 10 项功能扩展建议，分为三个优先级：

**立即实现（高价值低成本）：**

- NodeToolbar、Panel、MiniMap、SelectionMode

**近期实现（核心功能）：**

- Edges、键盘快捷键、右键菜单、自动布局

**长期规划（锦上添花）：**

- 视口保存、节点分组

通过系统化实施这些功能，可以将画布体验提升到专业笔记软件（Notion、Obsidian Canvas）的水平，显著增强产品竞争力。

---

**文档维护：**

- 创建日期：2026-01-05
- 最后更新：2026-01-05
- 负责人：开发团队
- 审核人：产品经理
