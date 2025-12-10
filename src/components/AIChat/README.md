# AIChat 组件

统一的 AI 对话解决方案，完全基于 Ant Design X 官方组件构建。

## 📁 目录结构

```
src/components/AIChat/
├── index.ts                    # 对外统一导出（公共 API）
├── types.ts                    # 类型定义
├── core/
│   └── AIChatPanel.tsx        # 主组件（使用官方 Bubble + Sender）
├── components/                 # 内部 UI 组件
│   └── MarkdownRenderer.tsx   # 官方 XMarkdown + Mermaid + Think
├── hooks/
│   ├── useAIChat.ts           # 对话管理 Hook（处理 <think> 标签）
│   ├── useAIConfig.ts         # 配置管理 Hook
│   └── index.ts
├── utils.ts                    # 工具函数
└── styles/
    └── AIChat.css             # 样式文件
```

## 🎯 设计原则

1. **完全使用官方组件**：基于 `@ant-design/x` 和 `@ant-design/x-markdown` 构建
2. **不自己造轮子**：Mermaid、Think、XMarkdown 均使用官方实现
3. **标准化数据格式**：使用 `<think>` 标签包装思维链内容
4. **单一职责**：所有 AI 对话相关的逻辑都在 AIChat 内部

## 📦 核心技术栈

### Ant Design X 组件

- **Bubble**: 消息气泡，使用 `contentRender` 渲染 Markdown
- **Sender**: 输入框组件
- **XMarkdown**: Markdown 渲染器（来自 `@ant-design/x-markdown`）
- **Mermaid**: 图表渲染组件
- **Think**: 思维链展示组件（可折叠）

### 官方样式

```tsx
import '@ant-design/x-markdown/themes/light.css';
<XMarkdown className="x-markdown-light" content={content} />;
```

## 📦 对外 API

### 组件

```tsx
import { AIChatPanel } from '@/components/AIChat';

<AIChatPanel
  conversationId="conversation-id"
  title="对话标题"
  onTitleChange={(title) => console.log(title)}
  showTitleEditor={true}
  className="custom-class"
/>;
```

### 类型

```tsx
import type {
  ChatItem,
  AIMessageData,
  AIChatPanelProps,
  ThoughtChainItems,
} from '@/components/AIChat';
```

## 🚫 不对外暴露

以下为内部实现，外部组件不应直接导入：

- ❌ `components/MarkdownRenderer` - 内部 Markdown 渲染
- ❌ `hooks/useAIChat` - 内部对话管理
- ❌ `hooks/useAIConfig` - 内部配置管理
- ❌ `utils` - 内部工具函数

## 📍 使用位置

1. **AI 工作台** - `src/features/ai-workbench/views/ChatEditor/tabs/AITab.tsx`
2. **便签 AI Tab** - `src/features/note/views/NoteEditor/tabs/AITab.tsx`

## ✨ 功能特性

- ✅ 流式对话渲染
- ✅ Mermaid 图表支持
- ✅ 思考过程显示
- ✅ Provider 切换
- ✅ 消息复制/保存
- ✅ 停止生成
- ✅ 标题编辑

## 🔄 升级说明

### v2.0 (2025-12-10)

**架构重构**：

- ✅ 升级到 Ant Design X 2.1.0
- ✅ 整合 Markdown 渲染器到 AIChat 内部
- ✅ 移除独立的 AIMarkdown 组件
- ✅ 规范化对外 API

**API 变化**：

- 🔄 适配 Ant Design X 2.1.0 新 API
- 🔄 移除 `roles` 属性，改用单项配置
- 🔄 更新 `typing` 动画配置
- 🔄 简化 avatar 配置

## 📝 开发指南

### 添加新功能

1. 在 `components/` 下创建内部组件
2. 在 `hooks/` 下创建内部 Hook
3. 在 `utils.ts` 中添加工具函数
4. 更新 `types.ts` 类型定义
5. **只在必要时**更新 `index.ts` 导出

### 原则

- **内部优先**：新功能优先作为内部实现
- **最小暴露**：只暴露必须对外的 API
- **类型安全**：所有导出都有完整类型定义
