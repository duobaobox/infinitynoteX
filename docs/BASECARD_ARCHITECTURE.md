# BaseCard 卡片组件架构

## 📁 文件结构

```
components/
└── BaseCard/                          ⭐ 卡片组件核心目录（自包含）
    ├── BaseCard.tsx                   ✅ 通用卡片基础组件
    ├── BaseCard.css                   ✅ 通用样式
    ├── index.ts                       ✅ 统一导出
    │
    ├── backgrounds/                   🎨 背景装饰系统
    │   ├── index.tsx                  ✅ 背景注册表 + 统一导出
    │   ├── backgrounds.css            ✅ 所有背景样式
    │   ├── StackedBackground.tsx      ✅ 堆叠卡片背景
    │   ├── RobotBackground.tsx        ✅ 机器人背景
    │   └── ChecklistBackground.tsx    ✅ 清单背景
    │
    ├── NoteCard.tsx                   📝 便签卡片 (配置)
    ├── ConversationCard.tsx           🤖 AI对话卡片 (配置)
    └── TodoCard.tsx                   ✅ 待办卡片 (配置)

├── CardBackground/                    ⚠️ 已废弃，重定向到 BaseCard/backgrounds
│   ├── CardBackground.tsx             → StackedBackground
│   └── RobotBackground.tsx            → RobotBackground
```

---

## 🎯 导入方式

### ✅ 标准导入

```typescript
// 推荐：从 BaseCard 统一导入
import { NoteCard, ConversationCard, TodoCard } from '@/components/BaseCard';
import type { NoteCardProps, ConversationCardProps, TodoCardProps } from '@/components/BaseCard';

// 导入背景组件（如需自定义）
import { StackedBackground, RobotBackground, registerBackground } from '@/components/BaseCard';
```

---

## 📋 核心组件说明

### 1. BaseCard（基础组件）

所有卡片的核心，提供：

- 主题色监听 ✅
- 暗色模式检测 ✅
- 选中状态管理 ✅
- 背景装饰渲染 ✅
- 事件处理（点击、钉住等）✅

### 2. backgrounds/ 背景系统

统一管理所有背景装饰：

- **StackedBackground** - 堆叠卡片效果
- **RobotBackground** - 机器人图标
- **ChecklistBackground** - 清单勾选图标
- **registerBackground()** - 运行时注册新背景

### 3. 特化卡片

轻量级封装，只需配置 BaseCard 参数：

```tsx
// NoteCard：堆叠背景 + 支持颜色 + 支持钉住
<BaseCard backgroundType="stacked" pinnable colorable />

// ConversationCard：机器人背景 + 固定颜色 + 无钉住
<BaseCard backgroundType="robot" pinnable={false} colorable={false} />

// TodoCard：清单背景 + 支持颜色 + 支持钉住
<BaseCard backgroundType="checklist" pinnable colorable />
```

---

## 🚀 添加新卡片类型

### 只需 3 步

**步骤 1：添加背景装饰**（如需要）

```
CardBackground/TaskBackground.tsx
```

**步骤 2：创建特化卡片**

```
BaseCard/cards/TaskCard/
├── TaskCard.tsx
├── TaskCard.css
└── index.ts
```

**步骤 3：更新 BaseCard 类型**

```typescript
// BaseCard/types.ts
type CardBackgroundType = '...' | 'task';
```

---

## 📊 代码量统计

| 文件                 | 行数     | 说明                 |
| -------------------- | -------- | -------------------- |
| BaseCard.tsx         | ~110     | 核心逻辑             |
| useCardTheme.ts      | ~70      | 主题 Hook            |
| NoteCard.tsx         | 34       | 轻量配置             |
| ConversationCard.tsx | 33       | 轻量配置             |
| **总计**             | **~247** | **支持所有卡片类型** |

**对比之前：**

- ❌ 旧方式：每个卡片 100+ 行（重复代码）
- ✅ 新方式：每个卡片 30+ 行（仅配置）
- **减少代码 70%** 🎉

---

## 🔄 导入路径

所有有效的导入方式都指向同一实现：

```typescript
// 方式 1: 推荐（简洁）
import { NoteCard } from '@/components/BaseCard';

// 方式 2: 完整路径
import NoteCard from '@/components/BaseCard/cards/NoteCard';

// 方式 3: 导出文件
import NoteCard from '@/components/BaseCard/cards/NoteCard/NoteCard';

// 所有方式都有效 ✅
```

---

## 📝 最佳实践

### ✅ DO

```typescript
// 1. 新增卡片时，放在 BaseCard/cards/ 中
// 2. 只配置 BaseCard 参数，不重复实现逻辑
// 3. 从 BaseCard 导出卡片
export { NoteCard } from './cards/NoteCard';

// 4. 使用 useCardTheme 处理主题
const { bgColor, borderColor } = useCardTheme({ color, isInteractive });
```

### ❌ DON'T

```typescript
// 1. 不要在卡片中重新监听主题色
addEventListener('theme-color-change', ...)  // ❌

// 2. 不要处理暗色模式检测
document.documentElement.getAttribute('data-theme')  // ❌

// 3. 不要直接使用 useNoteCardTheme
useNoteCardTheme(...)  // ❌ 应该用 useCardTheme

// 4. 不要把卡片放在其他位置
components/XxxCard/XxxCard.tsx  // ❌ 应该放在 BaseCard/cards/
```

---

## 🎓 学习路径

如果你想理解整个架构：

1. **先看** `BaseCard/BaseCard.tsx` - 理解核心逻辑
2. **再看** `BaseCard/useCardTheme.ts` - 理解主题管理
3. **然后看** `BaseCard/cards/NoteCard/NoteCard.tsx` - 理解如何使用
4. **最后看** `BaseCard/types.ts` - 理解类型定义

---

## 🔗 相关文档

- 详细扩展指南：`docs/CARD_EXTENSION_GUIDE.md`
- 组件分析报告：`docs/组件解耦与架构优化报告-2025Q4.md`
