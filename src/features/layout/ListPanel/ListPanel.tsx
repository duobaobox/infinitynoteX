import React, { useRef, useState, useEffect } from 'react';
import { Badge } from 'antd';
import { DEFAULT_TOOLS } from '../../../constants/tools';
import { getThemeColor } from '../../../theme/theme';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { NoteListView } from '../../note/views/NoteList/NoteListView';
import { ConversationListView } from '../../ai-chat/views/ConversationList/ConversationListView';
import './ListPanel.css';

interface ListPanelProps {
  flex: string | number;
}

/**
 * ListPanel - 列表面板路由容器
 * 根据 workspaceView 渲染不同的列表视图
 */
const ListPanel: React.FC<ListPanelProps> = ({ flex }) => {
  const { workspaceView, selectedToolId, setSelectedTool } = useWorkspaceStore();
  const [themeColor, setThemeColor] = useState(getThemeColor());
  const scrollableListRef = useRef<HTMLDivElement>(null);
  const flexVerticalEqualRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  const isNoteView = workspaceView === 'note';
  const toolList = DEFAULT_TOOLS;
  const effectiveToolId = selectedToolId || toolList[0]?.id || null;
  const isAiChatView = !isNoteView && effectiveToolId === 'ai-chat';

  // 监听主题色变化
  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setThemeColor(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // 检测滚动条
  useEffect(() => {
    const scrollableElement = scrollableListRef.current;
    if (!scrollableElement) return;

    const resizeObserver = new ResizeObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    resizeObserver.observe(scrollableElement);

    const mutationObserver = new MutationObserver(() => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    });

    mutationObserver.observe(scrollableElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // 动态更新 padding
  useEffect(() => {
    if (flexVerticalEqualRef.current) {
      if (isOverflow) {
        flexVerticalEqualRef.current.style.paddingRight = '0px';
      } else {
        flexVerticalEqualRef.current.style.paddingRight = '10px';
      }
    }
  }, [isOverflow]);

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
      <div className="flex-vertical-equal" ref={flexVerticalEqualRef}>
        <div className="scrollable-list" ref={scrollableListRef}>
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
