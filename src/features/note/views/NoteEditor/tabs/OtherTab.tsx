/**
 * OtherTab.tsx
 * 其他面板
 */

import React from 'react';
import { AppstoreOutlined } from '@ant-design/icons';
import './EmptyState.css';

/**
 * 空状态组件 - 当没有便签选中时显示
 */
const EmptyState: React.FC = () => (
  <div className="editor-empty-state">
    <AppstoreOutlined className="editor-empty-icon" />
    <p className="editor-empty-text">选择一个便签后可以查看详细信息</p>
  </div>
);

interface OtherTabProps {
  noteId: string | null;
}

export const OtherTab: React.FC<OtherTabProps> = ({ noteId }) => {
  // 没有选中便签时，显示空状态
  if (!noteId) {
    return <EmptyState />;
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>其他面板</div>
      <div style={{ color: 'var(--text-secondary)' }}>功能开发中...</div>
      {/* 后续添加其他功能组件 */}
    </div>
  );
};

export default OtherTab;
