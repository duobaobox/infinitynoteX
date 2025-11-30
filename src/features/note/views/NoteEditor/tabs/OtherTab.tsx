/**
 * OtherTab.tsx
 * 其他面板
 */

import React from 'react';

interface OtherTabProps {
  noteId: string | null;
}

export const OtherTab: React.FC<OtherTabProps> = () => {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>其他面板</div>
      <div style={{ color: 'var(--text-secondary)' }}>功能开发中...</div>
      {/* 后续添加其他功能组件 */}
    </div>
  );
};

export default OtherTab;
