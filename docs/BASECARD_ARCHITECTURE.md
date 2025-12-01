# BaseCard 卡片组件架构

## 📁 目录结构

```
BaseCard/
├── index.tsx          # 基础卡片组件（所有核心逻辑）
├── BaseCard.css       # 基础样式
│
└── cards/             # 特化卡片
    ├── NoteCard/
    │   ├── index.tsx      # 便签卡片（引入 BaseCard + 配置）
    │   └── NoteCard.css   # 便签图标 + 特殊样式
    │
    └── ConversationCard/
        ├── index.tsx      # 对话卡片（引入 BaseCard + 配置）
        └── ConversationCard.css  # 机器人图标 + 特殊样式
```

## 🎯 导入方式

```typescript
// 导入特化卡片
import NoteCard from '@/components/BaseCard/cards/NoteCard';
import ConversationCard from '@/components/BaseCard/cards/ConversationCard';

// 导入 Context（列表场景）
import { CardListContext } from '@/components/BaseCard/cards/NoteCard';
```

## 🚀 添加新卡片

只需 2 个文件：

### 1. `cards/TodoCard/index.tsx`

```tsx
import React from 'react';
import { CheckSquareOutlined } from '@ant-design/icons';
import BaseCard, { CardListContext } from '../../index';
import type { BaseCardProps } from '../../index';
import './TodoCard.css';

const TodoIcon = () => (
  <div className="todo-icon">
    <div className="todo-icon__box">
      <CheckSquareOutlined />
    </div>
  </div>
);

export interface TodoCardProps
  extends Omit<BaseCardProps, 'renderIcon' | 'colorable' | 'pinnable'> {}

const TodoCard: React.FC<TodoCardProps> = (props) => (
  <BaseCard {...props} colorable pinnable renderIcon={() => <TodoIcon />} className="todo-card" />
);

export default TodoCard;
export { CardListContext };
```

### 2. `cards/TodoCard/TodoCard.css`

```css
.todo-icon__box {
  position: absolute;
  width: 50px;
  height: 50px;
  bottom: 10px;
  left: 20px;
  border-radius: 5px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  transform: rotate(-12deg);
  transition: all 0.3s ease-in-out;
  background: linear-gradient(135deg, #f6ffed 30%, #d9f7be 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #52c41a;
}

.base-card:hover .todo-icon__box {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.18);
  transform: rotate(-15deg) translateY(-2px);
}

[data-theme='dark'] .todo-icon__box {
  border-color: rgba(255, 255, 255, 0.15);
  background: linear-gradient(135deg, #162312 30%, #1d3712 100%);
  color: #49aa19;
}
```

完成！
