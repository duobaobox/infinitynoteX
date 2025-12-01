# 卡片组件扩展指南

## 架构概览

```
┌─────────────────────────────────────────────────────┐
│              BaseCard (通用基础组件)                 │
│   ✓ 主题管理  ✓ 选中检测  ✓ 事件处理  ✓ 背景渲染   │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ↓               ↓               ↓
   ┌──────────┐   ┌────────────┐   ┌──────────┐
   │ NoteCard │   │Conversation│   │ TodoCard │
   │ (便签)   │   │Card(对话)  │   │ (待办)   │
   └──────────┘   └────────────┘   └──────────┘
         │               │               │
   backgroundType:  backgroundType:  backgroundType:
    "stacked"        "robot"        "checklist"
```

## 🚀 极简扩展流程

### 添加新卡片类型：只需 1 个文件！

**示例：添加 "书签卡片" (BookmarkCard)**

```tsx
// src/components/BaseCard/BookmarkCard.tsx

import React from 'react';
import BaseCard from './BaseCard';
import type { NoteCardColor } from '../../hooks/useNoteCardTheme';

export interface BookmarkCardProps {
  id?: string;
  title: string;
  content: string;
  color?: NoteCardColor;
  onClick?: () => void;
  onPin?: () => void;
  actions?: React.ReactNode;
}

const BookmarkCard: React.FC<BookmarkCardProps> = (props) => (
  <BaseCard {...props} backgroundType="stacked" pinnable colorable />
);

export default BookmarkCard;
```

然后在 `index.ts` 中导出即可！

---

## 📦 目录结构

```
BaseCard/
├── BaseCard.tsx              # 核心组件（所有逻辑）
├── BaseCard.css              # 卡片主体样式
├── index.ts                  # 统一导出
│
├── backgrounds/              # 🎨 背景装饰系统
│   ├── index.ts              # 背景注册表 + 导出
│   ├── backgrounds.css       # 所有背景样式
│   ├── StackedBackground.tsx # 堆叠卡片背景
│   ├── RobotBackground.tsx   # 机器人背景
│   └── ChecklistBackground.tsx # 清单背景
│
├── NoteCard.tsx              # 便签卡片 (配置)
├── ConversationCard.tsx      # 对话卡片 (配置)
└── TodoCard.tsx              # 待办卡片 (配置)
```

---

## 🎨 添加新背景类型

如果内置背景不满足需求，添加新背景也很简单：

### 步骤 1：创建背景组件

```tsx
// src/components/BaseCard/backgrounds/FolderBackground.tsx

import React from 'react';
import { FolderOutlined } from '@ant-design/icons';

const FolderBackground: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`card-bg card-bg-folder ${className}`}>
      <div className="card-bg-folder__icon">
        <FolderOutlined />
      </div>
    </div>
  );
};

export default FolderBackground;
```

### 步骤 2：添加样式

在 `backgrounds/backgrounds.css` 中添加：

```css
/* Folder 文件夹背景 */
.card-bg-folder__icon {
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
  background: linear-gradient(135deg, #fff7e6 30%, #ffe7ba 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fa8c16;
}

.base-card:hover .card-bg-folder__icon {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.18);
  transform: rotate(-15deg) translateY(-2px);
}

/* 暗色模式 */
[data-theme='dark'] .card-bg-folder__icon {
  border-color: rgba(255, 255, 255, 0.15);
  background: linear-gradient(135deg, #2b1d11 30%, #3d2612 100%);
  color: #d87a16;
}
```

### 步骤 3：注册背景

在 `backgrounds/index.ts` 中：

```typescript
import FolderBackground from './FolderBackground';

// 添加到类型
export type CardBackgroundType = 'stacked' | 'robot' | 'checklist' | 'folder' | 'none';

// 添加到注册表
const BackgroundRegistry = {
  stacked: StackedBackground,
  robot: RobotBackground,
  checklist: ChecklistBackground,
  folder: FolderBackground, // ← 新增
};
```

### 步骤 4：使用新背景

```tsx
const ProjectCard: React.FC<Props> = (props) => (
  <BaseCard {...props} backgroundType="folder" pinnable colorable />
);
```

---

## 📋 卡片配置矩阵

| 卡片类型             | backgroundType | pinnable | colorable | 背景装饰 |
| -------------------- | -------------- | -------- | --------- | -------- |
| **NoteCard**         | `stacked`      | ✅       | ✅        | 堆叠卡片 |
| **ConversationCard** | `robot`        | ❌       | ❌        | 机器人   |
| **TodoCard**         | `checklist`    | ✅       | ✅        | 清单勾选 |
| **自定义**           | `none`         | 可选     | 可选      | 无背景   |

---

## 🔧 常见场景

### 场景1：使用内置背景

```tsx
<BaseCard backgroundType="stacked" pinnable colorable {...props} />
```

### 场景2：不要背景

```tsx
<BaseCard backgroundType="none" pinnable colorable {...props} />
```

### 场景3：完全自定义背景

```tsx
<BaseCard renderBackground={() => <MyCustomBackground />} pinnable colorable {...props} />
```

### 场景4：运行时注册新背景

```typescript
import { registerBackground } from '@/components/BaseCard';

// 在应用启动时注册
registerBackground('custom', MyCustomBackground);

// 然后使用
<BaseCard backgroundType="custom" {...props} />
```

---

## ✅ 最佳实践

### DO ✅

```typescript
// 1. 特化组件只做配置，不重复逻辑
const MyCard = (props) => (
  <BaseCard {...props} backgroundType="xxx" pinnable colorable />
);

// 2. 导出类型供外部使用
export type { MyCardProps } from './MyCard';

// 3. 背景样式统一放在 backgrounds.css
```

### DON'T ❌

```typescript
// 1. 不要在特化组件中重复主题逻辑
const [themeColor, setThemeColor] = useState(...) // ❌

// 2. 不要直接修改 BaseCard.tsx
// 应该通过配置和背景注册表扩展

// 3. 不要把背景组件散落在各处
// 应该统一放在 backgrounds/ 目录
```

---

## 📊 架构对比

### 旧架构（分散）

```
components/
├── CardBackground/           # 背景在这里
│   ├── CardBackground.tsx
│   └── RobotBackground.tsx
├── BaseCard/                 # 卡片在这里
│   ├── BaseCard.tsx
│   ├── NoteCard.tsx
│   └── ConversationCard.tsx
```

**问题**：添加新卡片需要在两个目录操作

### 新架构（自包含）

```
components/
└── BaseCard/                 # 一切都在这里
    ├── BaseCard.tsx
    ├── backgrounds/          # 背景作为子模块
    │   ├── StackedBackground.tsx
    │   ├── RobotBackground.tsx
    │   └── backgrounds.css
    ├── NoteCard.tsx
    ├── ConversationCard.tsx
    └── TodoCard.tsx
```

**优势**：

- ✅ 单一目录，易于维护
- ✅ 添加新卡片只需 1 个文件
- ✅ 添加新背景只需修改 backgrounds/ 目录
- ✅ 背景注册表支持运行时扩展

---

## 🎯 总结

| 操作                       | 需要修改的文件              |
| -------------------------- | --------------------------- |
| 添加新卡片（使用现有背景） | 1 个：`XxxCard.tsx`         |
| 添加新卡片（新背景类型）   | 3 个：背景组件 + CSS + 注册 |
| 修改背景样式               | 1 个：`backgrounds.css`     |

**核心理念**：配置优于编码，注册优于硬编码
