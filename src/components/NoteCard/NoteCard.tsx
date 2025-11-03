import React from 'react';
import './NoteCard.css';
import { getThemeColor } from '../../theme/theme';

export interface NoteCardProps {
  title: string;
  content: string;
  color?: 'bae0ff' | 'd9f7be' | 'ffd6e7' | 'd6e4ff' | 'ffd666' | 'ffffff';
  onClick?: () => void;
  actions?: React.ReactNode; // 右上角操作区（如删除、固定等）
  id?: string; // 用于选中高亮
}

const NoteCard: React.FC<NoteCardProps> = ({
  title,
  content,
  color = 'ffffff',
  onClick,
  actions,
  id,
}) => {
  // 监听主题色变化
  const [themeColor, setThemeColor] = React.useState(getThemeColor());
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as unknown as CustomEvent<string>).detail;
      if (typeof color === 'string' && color) setThemeColor(color);
    };
    window.addEventListener('theme-color-change', handler as EventListener);
    return () => window.removeEventListener('theme-color-change', handler as EventListener);
  }, []);

  // 由父组件传递 selectedId，当前卡片是否选中
  const listContext = React.useContext(NoteCardListContext as any) as
    | { selectedId?: string }
    | undefined;
  const isSelected =
    listContext && listContext.selectedId === (typeof id === 'string' ? id : undefined);

  return (
    <div
      className={'note-card' + (isSelected ? ' note-card-selected' : '')}
      onClick={onClick}
      style={{
        // 只改变边框色：选中或悬浮时用主题色，默认用浅灰
        borderColor: isSelected || hovered ? themeColor : 'var(--border-color)',
        background: `#${color}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 左侧颜色标记条，增强在深色主题下的可视性 */}
      <div className="note-card-color" style={{ backgroundColor: `#${color}` }} aria-hidden />
      <div className="note-card-title">{title}</div>
      <div className="note-card-content">{content}</div>
      {actions && <div className="note-card-actions">{actions}</div>}
    </div>
  );
};

// 用于传递选中id到NoteCard
export const NoteCardListContext = React.createContext<
  { selectedId?: string; id?: string } | undefined
>(undefined);

export default NoteCard;
