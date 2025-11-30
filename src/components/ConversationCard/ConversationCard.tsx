import React from 'react';
import './ConversationCard.css';
import { getThemeColor } from '../../theme/theme';
import { useNoteCardTheme } from '../../hooks/useNoteCardTheme';
import RobotBackground from '../CardBackground/RobotBackground';
import { NoteCardListContext } from '../CardContext/CardContext';

export interface AIConversationCardProps {
  title: string;
  content: string;
  onClick?: () => void;
  actions?: React.ReactNode; // 右上角操作区（如删除等）
  id?: string; // 用于选中高亮
}

const AIConversationCard: React.FC<AIConversationCardProps> = ({
  title,
  content,
  onClick,
  actions,
  id,
}) => {
  // 监听主题色变化
  const [themeColor, setThemeColor] = React.useState(getThemeColor());
  const [hovered, setHovered] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    const handler: EventListener = (event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'string' && event.detail) {
        setThemeColor(event.detail);
      }
    };
    window.addEventListener('theme-color-change', handler);
    return () => window.removeEventListener('theme-color-change', handler);
  }, []);

  // 检测暗色模式
  React.useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setIsDarkMode(isDark);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkMode(isDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // 由父组件传递 selectedId，当前卡片是否选中
  const listContext = React.useContext(NoteCardListContext);
  const isSelected =
    listContext && listContext.selectedId === (typeof id === 'string' ? id : undefined);

  // AI卡片在暗色模式下使用深色背景，亮色模式使用白色
  const isInteractive = isSelected || hovered;
  const { borderColor } = useNoteCardTheme('ffffff', themeColor, isInteractive);
  const bgColor = isDarkMode ? '#262626' : '#ffffff'; // 暗色模式使用深色背景

  return (
    <div
      className={'note-card group' + (isSelected ? ' note-card-selected' : '')}
      onClick={onClick}
      style={{
        background: bgColor,
        borderColor: borderColor,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* AI机器人背景装饰 */}
      <RobotBackground className="note-card-pattern" />

      {/* 卡片内容 */}
      <div className="note-card-content-wrapper">
        <div>
          <div className="note-card-title" title={title}>
            {title.length > 10 ? title.slice(0, 10) + '…' : title}
          </div>
          <div className="note-card-content">{content}</div>
        </div>
      </div>

      {/* 操作区（右上角，仅删除按钮，无钉住按钮） */}
      <div className="note-card-actions">{actions}</div>
    </div>
  );
};

export default AIConversationCard;
