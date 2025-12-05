/**
 * EditorPanel/index.tsx
 * 编辑器面板容器 - 根据 Feature Registry 动态渲染对应编辑器
 */

import React from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { getActiveFeature } from '../../../config/featureRegistry';

// 确保 Feature 模块被加载并完成注册
import '../../note';
import '../../ai-workbench';

/**
 * EditorPanel - 编辑器面板容器
 * 使用 Feature Registry 动态查找并渲染编辑器组件
 */
const EditorPanel: React.FC = () => {
  const workspaceView = useWorkspaceStore((state) => state.workspaceView);
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);

  // 从 Registry 获取当前激活的 Feature
  const feature = getActiveFeature(workspaceView, selectedToolId);

  if (!feature) {
    return null;
  }

  const EditorComponent = feature.EditorView;
  return <EditorComponent />;
};

export default EditorPanel;
