/**
 * TodoListCard - 清单卡片组件
 *
 * 继承 BaseCard 基础样式，使用与 NoteCard/BrowserCard 相似的图标设计
 */

import React from 'react';
import { Button, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import './TodoListCard.css';

export { CardListContext };

export interface TodoListCardProps {
  id: string;
  name: string;
  isDefault: boolean;
  color?: string;
  onClick?: () => void;
  onDelete?: () => void;
}

const TodoListCard: React.FC<TodoListCardProps> = ({
  id,
  name,
  isDefault,
  color,
  onClick,
  onDelete,
}) => {
  // 图标装饰：类似 NoteCard 的设计
  const renderIcon = () => (
    <div
      className={`todo-list-icon__box ${isDefault ? 'todo-list-icon__box--default' : ''}`}
      style={color ? ({ '--todo-list-color': color } as React.CSSProperties) : undefined}
    >
      <div className="todo-list-icon__shine" />
      <div className="todo-list-icon__content">
        {isDefault ? (
          // 默认清单：便签样式的图标
          <>
            <div className="todo-list-icon__checkbox" />
            <div className="todo-list-icon__checkbox" />
            <div className="todo-list-icon__checkbox" />
          </>
        ) : (
          // 自定义清单：清单样式的图标
          <>
            <div className="todo-list-icon__item" />
            <div className="todo-list-icon__item" />
            <div className="todo-list-icon__item" />
          </>
        )}
      </div>
    </div>
  );

  // 使用 Button 组件，与 BaseCard 的 actions 样式一致
  const actions =
    !isDefault && onDelete ? (
      <Popconfirm
        title="删除清单"
        description="确定要删除这个清单吗？"
        onConfirm={(e) => {
          e?.stopPropagation();
          onDelete();
        }}
        okText="删除"
        cancelText="取消"
        placement="right"
      >
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={(e) => e.stopPropagation()}
        />
      </Popconfirm>
    ) : undefined;

  return (
    <BaseCard
      id={id}
      title={name}
      content={isDefault ? '来自便签的任务' : '自定义清单'}
      colorable={false}
      renderIcon={renderIcon}
      onClick={onClick}
      actions={actions}
    />
  );
};

export default React.memo(TodoListCard);
