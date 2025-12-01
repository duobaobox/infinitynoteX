# 卡片组件扩展指南

## 架构概览

```
┌─────────────────────────────────────────┐
│         BaseCard (通用基础组件)          │
│  ✓ 主题管理 ✓ 选中检测 ✓ 事件处理      │
└─────────────────────────────────────────┘
        ↓                ↓               ↓
   ┌────────┐      ┌──────────┐     ┌─────────┐
   │NoteCard│      │Conversation│   │ XXXCard │
   │(便签)   │      │Card(对话)  │   │(新增)   │
   └────────┘      └──────────┘     └─────────┘
       ↓                ↓               ↓
   NoteListView  ConversationView  XXXListView
```

## 添加新卡片类型的完整步骤

### 例：添加 "任务卡片" (TaskCard)

#### 第一步：添加背景装饰（如需要）

**文件：** `src/components/CardBackground/TaskBackground.tsx`

```tsx
import React from 'react';
import { CheckCircleOutlined } from '@ant-design/icons';
import './TaskBackground.css';

export interface TaskBackgroundProps {
  className?: string;
}

/**
 * 任务卡片背景装饰 - 勾选圆圈样式
 */
const TaskBackground: React.FC<TaskBackgroundProps> = ({ className = '' }) => {
  return (
    <div className={`card-background-pattern task-card-wrapper ${className}`}>
      <div className="task-card">
        <CheckCircleOutlined />
      </div>
    </div>
  );
};

export default TaskBackground;
```

**文件：** `src/components/CardBackground/TaskBackground.css`

```css
.task-card-wrapper {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 80px;
  height: 80px;
  opacity: 0.15;
  transition: all 0.3s ease;
}

.task-card {
  font-size: 60px;
  color: #52c41a;
  transform: rotate(-20deg);
}

.note-card:hover .task-card {
  transform: rotate(-15deg) translateY(-2px);
}
```

#### 第二步：更新 BaseCard 类型

**文件：** `src/components/BaseCard/types.ts`

```typescript
// 修改这一行
export type CardBackgroundType = 'stacked' | 'robot' | 'task' | 'none';
```

#### 第三步：创建特化组件

**文件：** `src/components/TaskCard/TaskCard.tsx`

```tsx
/**
 * TaskCard - 任务卡片组件
 *
 * 基于 BaseCard 的任务卡片特化组件
 * 特性：
 * - 任务勾选背景装饰
 * - 支持颜色主题
 * - 不支持钉住（可选，根据需求改 pinnable）
 */

import React from 'react';
import { BaseCard } from '../BaseCard';
import type { NoteCardColor } from '../../hooks/useNoteCardTheme';
import './TaskCard.css';

export interface TaskCardProps {
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  actions?: React.ReactNode;
  id?: string;
  onPin?: () => void; // 可选：如果支持钉住
}

const TaskCard: React.FC<TaskCardProps> = ({
  title,
  content,
  color = 'ffffff',
  onClick,
  actions,
  id,
  onPin,
}) => {
  return (
    <BaseCard
      id={id}
      title={title}
      content={content}
      color={color}
      backgroundType="task"
      features={{
        pinnable: true, // 改为 false 如果不需要
        colorable: true,
      }}
      onClick={onClick}
      onPin={onPin}
      actions={actions}
      className="task-card-wrapper"
    />
  );
};

export default TaskCard;
```

**文件：** `src/components/TaskCard/TaskCard.css`

```css
@import '../BaseCard/BaseCard.css';

.task-card-wrapper {
  /* 继承 BaseCard 基础样式 */
}

.task-card-wrapper:hover .task-card {
  opacity: 0.2;
  transform: rotate(-15deg) translateY(-2px);
}
```

**文件：** `src/components/TaskCard/index.ts`

```typescript
export { default as TaskCard } from './TaskCard';
export { default } from './TaskCard';
export type { TaskCardProps } from './TaskCard';
```

#### 第四步：在列表视图中使用

**文件：** `src/features/task/views/TaskList/TaskListView.tsx`

```tsx
import TaskCard from '../../../../components/TaskCard/TaskCard';
import { NoteCardListContext } from '../../../../components/CardContext/CardContext';

// 使用方式与 NoteListView 完全相同
<NoteCardListContext.Provider value={{ selectedId }}>
  {tasks.map((task) => (
    <TaskCard
      key={task.id}
      id={task.id}
      title={task.title}
      content={task.content}
      color={task.color}
      onClick={() => selectTask(task.id)}
      onPin={() => pinTask(task.id)}
      actions={<DeleteButton />}
    />
  ))}
</NoteCardListContext.Provider>;
```

---

## 快速参考：卡片配置矩阵

| 卡片类型             | backgroundType | pinnable | colorable | 背景装饰 | 备注         |
| -------------------- | -------------- | -------- | --------- | -------- | ------------ |
| **NoteCard**         | `stacked`      | ✅       | ✅        | 堆叠卡片 | 便签         |
| **ConversationCard** | `robot`        | ❌       | ❌        | 机器人   | AI对话       |
| **TaskCard**         | `task`         | ✅       | ✅        | 勾选圆圈 | 任务（示例） |
| **ProjectCard**      | `project`      | ✅       | ❌        | 文件夹   | 项目（示例） |
| **CustomCard**       | `none`         | ❌       | ❌        | 无       | 完全自定义   |

---

## 常见场景

### 场景1：添加背景，支持颜色和钉住

```tsx
<BaseCard
  backgroundType="project"
  features={{ pinnable: true, colorable: true }}
  color={color}
  onPin={onPin}
  {...props}
/>
```

### 场景2：固定背景，不支持颜色和钉住（如对话卡片）

```tsx
<BaseCard backgroundType="robot" features={{ pinnable: false, colorable: false }} {...props} />
```

### 场景3：完全自定义背景

```tsx
<BaseCard
  renderBackground={() => <MyCustomBackground />}
  features={{ pinnable: false, colorable: true }}
  {...props}
/>
```

### 场景4：不要背景，只要基础卡片

```tsx
<BaseCard backgroundType="none" features={{ pinnable: true, colorable: true }} {...props} />
```

---

## 最佳实践

### ✅ DO

```typescript
// 1. 背景装饰统一放在 CardBackground/ 文件夹
// 2. 特化组件放在自己的文件夹中
// 3. 导出接口和类型供外部使用
export { default as TaskCard } from './TaskCard';
export type { TaskCardProps } from './TaskCard';

// 4. 在特化组件中明确配置 BaseCard 参数
<BaseCard
  backgroundType="task"
  features={{ pinnable: true, colorable: true }}
/>
```

### ❌ DON'T

```typescript
// 1. 不要重复实现主题监听逻辑
const [themeColor, setThemeColor] = useState(...)  // ❌

// 2. 不要在特化组件中处理暗色模式
const isDark = document.documentElement.getAttribute(...)  // ❌

// 3. 不要绕过 BaseCard 直接使用 hook
useNoteCardTheme(...)  // ❌ 应该让 BaseCard 处理

// 4. 不要忘记导出类型
// export type { TaskCardProps }  // ❌ 必须导出
```

---

## 文件结构对比

### 旧方式（2个组件，重复代码）

```
components/
├── NoteCard/
│   ├── NoteCard.tsx        (97行，重复逻辑)
│   └── NoteCard.css
└── ConversationCard/
    ├── ConversationCard.tsx (96行，重复逻辑)
    └── ConversationCard.css
```

### 新方式（BaseCard + 特化组件，零重复）

```
components/
├── BaseCard/
│   ├── BaseCard.tsx           (核心逻辑)
│   ├── useCardTheme.ts        (主题Hook)
│   ├── CardBackgroundRenderer.tsx
│   ├── types.ts
│   └── BaseCard.css
├── CardBackground/
│   ├── CardBackground.tsx     (堆叠背景)
│   ├── RobotBackground.tsx    (机器人背景)
│   ├── TaskBackground.tsx     (任务背景 - 新增)
│   └── ...
├── NoteCard/
│   ├── NoteCard.tsx          (49行，仅配置)
│   └── NoteCard.css
├── ConversationCard/
│   ├── ConversationCard.tsx  (42行，仅配置)
│   └── ConversationCard.css
├── TaskCard/                 (新增)
│   ├── TaskCard.tsx          (配置)
│   ├── TaskCard.css
│   └── index.ts
└── ...
```

---

## 后续扩展思路

### 如果要添加更多功能卡片，按这个顺序：

1. **设计背景装饰** → `CardBackground/XxxBackground.tsx`
2. **更新类型定义** → `BaseCard/types.ts` 的 `CardBackgroundType`
3. **创建特化组件** → `XxxCard/XxxCard.tsx`
4. **集成到列表** → 在对应的 ListView 中使用

### 未来可能的卡片类型

- 📋 **TodoCard** - 待办事项（后台任务或清单）
- 📁 **FolderCard** - 文件夹/项目集
- 🏷️ **TagCard** - 标签管理
- 📊 **ReportCard** - 报告/分析
- 🔖 **BookmarkCard** - 书签
- 👥 **CollaboratorCard** - 协作者/分享

每一个都可以按上面的步骤快速添加！

---

## 总结

**核心理念：** 一次设计，无限扩展

- ✅ BaseCard 提供所有共通功能
- ✅ 特化组件只需配置参数
- ✅ 背景装饰完全独立，易于组合
- ✅ 新增卡片类型无需修改现有代码
