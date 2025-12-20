/**
 * TodoCard - 任务卡片组件
 * 配置：Checkbox 图标 + 无颜色 + 无钉住
 */

import React from 'react';
import { CheckSquareOutlined, BorderOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './TodoCard.css';

// 任务图标组件
const TaskIcon: React.FC<{ checked: boolean }> = React.memo(({ checked }) => (
  <div className={`todo-icon ${checked ? 'todo-icon--checked' : ''}`}>
    <div className="todo-icon__box">{checked ? <CheckSquareOutlined /> : <BorderOutlined />}</div>
  </div>
));

TaskIcon.displayName = 'TaskIcon';

export interface TodoCardProps extends Omit<
  BaseCardProps,
  'renderIcon' | 'colorable' | 'pinnable' | 'color'
> {
  /** 是否已完成 */
  checked?: boolean;
  /** 来源便签标题 */
  sourceNote?: string;
}

const TodoCard: React.FC<TodoCardProps> = ({ checked = false, sourceNote, content, ...props }) => (
  <BaseCard
    {...props}
    content={sourceNote ? `来自: ${sourceNote}` : content}
    colorable={false}
    pinnable={false}
    renderIcon={() => <TaskIcon checked={checked} />}
    className={`todo-card ${checked ? 'todo-card--checked' : ''}`}
  />
);

// 使用 React.memo 优化性能
export default React.memo(TodoCard);
export { CardListContext };
