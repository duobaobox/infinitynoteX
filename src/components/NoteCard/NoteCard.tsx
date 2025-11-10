import React from 'react';
import { PushpinOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import './NoteCard.css';
import { getThemeColor } from '../../theme/theme';
import { useNoteCardTheme, type NoteCardColor } from './useNoteCardTheme';
import CardBackground from '../CardBackground/CardBackground';

export interface NoteCardProps {
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  actions?: React.ReactNode; // 右上角操作区（如删除、固定等）
  onPin?: () => void; // 钉住按钮回调（暂无功能，预留）
  id?: string; // 用于选中高亮
}

const NoteCard: React.FC<NoteCardProps> = ({
  title,
  content,
  color = 'ffffff',
  onClick,
  actions,
  onPin,
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
      className={'note-card group' + (isSelected ? ' note-card-selected' : '')}
      onClick={onClick}
      style={{
        background: bgColor,
        borderColor: borderColor,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 堆叠便签卡片背景图案 */}
      <CardBackground className="note-card-pattern" />

      {/* 卡片内容 */}
      <div className="note-card-content-wrapper">
        <div>
          <div className="note-card-title" title={title}>
            {title.length > 10 ? title.slice(0, 10) + '…' : title}
          </div>
          <div className="note-card-content">{content}</div>
        </div>
      </div>

      <div className="note-card-actions">
        {/* 钉住按钮（使用 Ant Design Button 和 PushpinOutlined 图标，保持与删除按钮一致） */}
        <Button
          type="text"
          size="small"
          icon={<PushpinOutlined />}
          title="钉住"
          onClick={(e) => {
            e.stopPropagation();
            onPin?.();
          }}
        />
        {/* 删除按钮（由父组件通过 actions 传入） */}
        {actions}
      </div>
    </div>
  );
};

// 用于传递选中id到NoteCard
export const NoteCardListContext = React.createContext<
  { selectedId?: string; id?: string } | undefined
>(undefined);

export default NoteCard;
