/**
 * KitTab - 工具组件 Tab 页
 *
 * 开发中的占位组件
 */

import React from 'react';
import { DEFAULT_TOOLS } from '../../../../../constants/tools';
import { useWorkspaceStore } from '../../../../../store/workspaceStore';

export const KitTab: React.FC = () => {
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);
  const activeTool = DEFAULT_TOOLS.find((tool) => tool.id === selectedToolId);

  return (
    <div className="tool-panel-placeholder">
      <div className="tool-panel-placeholder-title">工具组件区开发中</div>
      <div className="tool-panel-placeholder-desc">
        {activeTool
          ? `「${activeTool.name}」功能将在此处呈现，当前仅展示共享框架以便持续复用。`
          : '尚未选择具体工具。'}
      </div>
    </div>
  );
};

export default KitTab;
