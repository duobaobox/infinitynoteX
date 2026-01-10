import React from 'react';
import { Dropdown, Tooltip, MenuProps } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

interface NoteReferenceProps {
  noteItems: MenuProps['items'];
  onSelect: MenuProps['onClick'];
}

export const NoteReference: React.FC<NoteReferenceProps> = ({ noteItems, onSelect }) => {
  if (!noteItems || noteItems.length === 0) {
    return null;
  }

  return (
    <Dropdown
      menu={{
        items: noteItems,
        onClick: onSelect,
      }}
      trigger={['click']}
      placement="topLeft"
    >
      <Tooltip title="引用便签">
        <span className="ai-icon-btn">
          <FileTextOutlined style={{ fontSize: 14 }} />
        </span>
      </Tooltip>
    </Dropdown>
  );
};
