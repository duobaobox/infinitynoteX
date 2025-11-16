import React from 'react';
import './NoteCard.css';
import { getThemeColor } from '../../../theme/theme';
import { useNoteCardTheme, type NoteCardColor } from './useNoteCardTheme';
import CardBackground from '../../../components/CardBackground/CardBackground';
import { NoteCardListContext } from './NoteCardContext';
import { Button } from 'antd';
import { PushpinOutlined } from '@ant-design/icons';

export interface NoteCardProps {
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  onPin?: () => void; // 钉住按钮的回调
  actions?: React.ReactNode; // 右上角操作区（如删除等）
  id?: string; // 用于选中高亮
}

const NoteCard: React.FC<NoteCardProps> = ({
  title,
  content,
  color = 'ffffff',
  onClick,
  onPin,
  actions,
  id,
}) => {
  // 监听主题色变化
  const [themeColor, setThemeColor] = React.useState(getThemeColor());
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    const handler: EventListener = (event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'string' && event.detail) {
        setThemeColor(event.detail);
      }
    };
    window.addEventListener('theme-color-change', handler);
    return () => window.removeEventListener('theme-color-change', handler);
  }, []);

  // 由父组件传递 selectedId，当前卡片是否选中
  const listContext = React.useContext(NoteCardListContext);
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
        {/* 钉住按钮 */}
        {onPin && (
          <Button
            type="text"
            size="small"
            icon={<PushpinOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
          />
        )}
        {/* 其他操作按钮（由父组件通过 actions 传入） */}
        {actions}
      </div>
    </div>
  );
};

export default NoteCard;
