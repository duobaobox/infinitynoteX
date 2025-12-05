import React from 'react';
import { Badge } from 'antd';
import { DEFAULT_TOOLS } from '../../../constants/tools';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { NoteListView } from '../../note/views/NoteList/NoteListView';
import { ConversationListView } from '../../ai-chat/views/ConversationList/ConversationListView';
import { useScrollOverflow } from '../../../hooks/useScrollOverflow';
import { useThemeColor } from '../../../hooks/useThemeColor';
import './ListPanel.css';

interface ListPanelProps {
  flex: string | number;
}

/**
 * ListPanel - 列表面板路由容器
 * 根据 workspaceView 渲染不同的列表视图
 */
const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  const workspaceView = useWorkspaceStore((state) => state.workspaceView);
  const selectedToolId = useWorkspaceStore((state) => state.selectedToolId);
  const setSelectedTool = useWorkspaceStore((state) => state.setSelectedTool);

  // 使用公共 hooks
  const themeColor = useThemeColor();
  const { scrollableRef, containerRef } = useScrollOverflow();

  const isNoteView = workspaceView === 'note';
  const toolList = DEFAULT_TOOLS;
  const effectiveToolId = selectedToolId || toolList[0]?.id || null;
  const isAiChatView = !isNoteView && effectiveToolId === 'ai-chat';

  // 便签列表视图
  if (isNoteView) {
    return <NoteListView flex={flex} />;
  }

  // AI 对话列表视图
  if (isAiChatView) {
    return <ConversationListView flex={flex} />;
  }

  // 工具列表视图
  return (
    <div className="layout-panel list-container" style={{ flex }}>
      <div className="flex-vertical-auto">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="folder-name" title="工具集合">
            工具集合
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge count={toolList.length} showZero style={{ backgroundColor: themeColor }} />
          </div>
        </div>
      </div>
      <div className="flex-vertical-equal" ref={containerRef}>
        <div className="scrollable-list" ref={scrollableRef}>
          {toolList.map((tool) => (
            <div
              key={tool.id}
              className={`tool-card${tool.id === effectiveToolId ? ' tool-card-selected' : ''}`}
              onClick={() => setSelectedTool(tool.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedTool(tool.id);
                }
              }}
            >
              <div>
                <div className="tool-card-title">{tool.name}</div>
                <div className="tool-card-desc">{tool.description}</div>
              </div>
              <span className="tool-card-icon">{tool.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListPanel;
