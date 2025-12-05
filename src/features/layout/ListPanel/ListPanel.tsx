/**
 * ListPanel - 列表面板路由容器
 * 根据 Feature Registry 动态渲染对应列表视图
 */

import React from 'react';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { getActiveFeature } from '../../../config/featureRegistry';
import './ListPanel.css';

// 确保 Feature 模块被加载并完成注册
import '../../note';
import '../../ai-workbench';

interface ListPanelProps {
  flex: string | number;
}

/**
 * ListPanel - 列表面板容器
 * 使用 Feature Registry 动态查找并渲染列表组件
 */
const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  const workspaceView = useWorkspaceStore((state) => state.workspaceView);
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);

  // 从 Registry 获取当前激活的 Feature
  const feature = getActiveFeature(workspaceView, selectedToolId);

  if (!feature) {
    return null;
  }

  const ListComponent = feature.ListView;
  return <ListComponent flex={flex} />;
};

export default ListPanel;
