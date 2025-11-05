import React from 'react';
import './NoteCard.css';
import { getThemeColor } from '../../theme/theme';
import { useNoteCardTheme, type NoteCardColor } from './useNoteCardTheme';

export interface NoteCardProps {
  title: string;
  content: string;
  color?: NoteCardColor;
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

  // 使用主题 hook 获取卡片的背景色和边框色
  const isInteractive = isSelected || hovered;
  const { bgColor, borderColor } = useNoteCardTheme(color, themeColor, isInteractive);

  return (
    <div
      className={'note-card' + (isSelected ? ' note-card-selected' : '')}
      onClick={onClick}
      style={{
        background: bgColor,
        borderColor: borderColor,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
