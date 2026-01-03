/**
 * NoteNode - 画布上的便签节点组件
 * 用于在无限画布中显示便签卡片
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import './NoteNode.css';

// 颜色映射表
const colorMap: Record<string, string> = {
  bae0ff: '#bae0ff',
  d9f7be: '#d9f7be',
  ffd6e7: '#ffd6e7',
  d6e4ff: '#d6e4ff',
  ffd666: '#ffd666',
  ffffff: '#ffffff',
};

export interface NoteNodeData {
  title: string;
  excerpt: string;
  color?: string;
  isSelected?: boolean;
  [key: string]: unknown; // 索引签名，满足 Record<string, unknown> 约束
}

interface NoteNodeProps {
  data: NoteNodeData;
}

const NoteNode: React.FC<NoteNodeProps> = ({ data }) => {
  const bgColor = data.color ? colorMap[data.color] || '#ffffff' : '#ffffff';

  return (
    <div
      className={`note-node ${data.isSelected ? 'note-node--selected' : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* 连接点（V2 可用于连线） */}
      <Handle type="target" position={Position.Top} className="note-node__handle" />

      <div className="note-node__content">
        <div className="note-node__title">{data.title || '无标题'}</div>
        {data.excerpt && <div className="note-node__excerpt">{data.excerpt}</div>}
      </div>

      <Handle type="source" position={Position.Bottom} className="note-node__handle" />
    </div>
  );
};

export default memo(NoteNode);
