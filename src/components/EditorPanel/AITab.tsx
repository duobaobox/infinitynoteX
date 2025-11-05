/**
 * AITab.tsx
 * AI 工作台 - AI 相关功能
 */

import React from 'react';

interface AITabProps {
  noteId: string | null;
}

export const AITab: React.FC<AITabProps> = () => {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>AI 工作台</div>
      <div style={{ color: 'var(--text-secondary)' }}>AI 功能开发中...</div>
      {/* 后续添加 AI 功能组件 */}
    </div>
  );
};

export default AITab;
