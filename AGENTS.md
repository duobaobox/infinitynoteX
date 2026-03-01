# AGENTS.md - InfinityNoteX 开发指南

本文档为在 InfinityNoteX 代码库中工作的 AI 代理提供指导方针和命令。

## 项目概述

**InfinityNoteX** 是一款基于 Electron 的跨平台笔记应用，版本 `1.1.1`。核心特性包括：

- 富文本编辑器（Tiptap）
- AI 对话与工作台
- WebDAV 同步
- 向量知识库检索
- 浮动窗口与快捷操作

## 构建命令

```bash
# 开发
npm run dev                    # 启动 Vite 开发服务器

# 构建
npm run build                  # 构建 Electron 应用（electron:build 的别名）
npm run web:build              # 构建 Web 版本（tsc && vite build）
npm run electron:build:win     # 构建 Windows 版本
npm run electron:build:mac     # 构建 macOS 版本
npm run electron:build:linux   # 构建 Linux 版本
npm run electron:build:all     # 构建所有平台（bash scripts/build-all.sh）
npm run build:all              # 构建所有平台（别名）

# 代码检查与格式化
npm run lint                   # 运行 ESLint
npm run lint:fix               # 运行 ESLint 并自动修复
npm run format                 # 运行 Prettier（写入所有）
npm run format:check           # 检查 Prettier 格式化

# 测试
npm run test                   # 运行测试（vitest，监听模式）
npm run test:ui                # 运行测试（vitest --ui，带 UI）
npm run test:run               # 运行测试（vitest run，无头模式）
npm run test:coverage          # 运行测试并生成覆盖率报告

# 单个测试文件
npm run test:run -- src/hooks/useNoteCardTheme.test.ts

# 原生模块（Node.js 升级后）
npm run rebuild                # 重建 better-sqlite3, sqlite-vec

# 其他
npm run preview                # 预览构建结果
npm run clean:release          # 清理发布目录
```

## 代码风格规范

### TypeScript

- `tsconfig.json` 中启用严格模式
- 启用 `noUnusedLocals` 和 `noUnusedParameters`
- 函数参数和返回值使用显式类型
- 避免使用 `any`；使用 `unknown` 或更具体的类型

### Prettier 配置

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### 导入顺序

- 尽可能使用绝对导入（通过 `baseUrl: "."` 配置）
- 分组导入：外部库 → 内部模块 → 类型定义
- 功能模块使用 `index.ts` 导出 barrel
- 示例：

```typescript
import { useState, useCallback } from 'react';
import { FolderStorage } from './FolderStorage';
import type { Note } from './types';
```

### 文件命名

- **React 组件 (`.tsx`)**：PascalCase（如 `NoteEditor.tsx`）
- **Hook (`.ts`)**：`use*` 前缀，camelCase（如 `useNoteSave.ts`）
- **工具/模块 (`.ts`)**：camelCase（如 `storageManager.ts`）
- **样式 (`.css`)**：与组件名匹配（如 `NoteEditor.css`）
- **测试文件**：匹配源文件 + `.test.ts`（如 `useNoteCardTheme.test.ts`）

### 组件结构

- 组件放在 `src/features/{feature}/views/` 目录下
- 使用 `index.ts` 做 barrel 导出
- 保持组件职责单一；复杂逻辑提取到 hook
- 示例结构：

```
src/features/note/
├── views/
│   ├── NoteEditor/
│   │   ├── index.tsx
│   │   ├── hooks/
│   │   └── tabs/
├── services/
├── types.ts
└── index.tsx
```

### 状态管理

- 全局状态使用 **Zustand**（见 `src/store/`）
- 在 `src/store/slices/` 创建状态切片
- 通过 `src/store/selectors/` 的选择器访问状态
- 当前切片：`aiConfig`, `aiConversation`, `appearance`, `app`, `browserCards`, `folder`, `knowledge`, `note`, `storage`, `sync`, `todo`, `ui`, `workspaceView`

### 错误处理

- 使用 `electron/storage/errors.ts` 中的 `StorageError` 类及错误码
- 异步操作使用 try-catch 包裹
- 使用 logger 模块记录带上下文的错误
- IPC handler 抛出描述性错误

### React 模式

- 使用函数式组件和 hook
- 自定义 hook 使用 `use*` 前缀
- 使用 `@testing-library/react` 的 `renderHook` 测试 hook
- 使用 `vitest` 的 `describe/it/expect` 构建测试

### 数据库（Electron 主进程）

- 使用 **better-sqlite3** + **sqlite-vec** 实现向量搜索
- 通过 `electron/storage/index.ts` 导出的 `storageManager` 单例访问
- 存储模块：`notes`、`folders`、`ai`、`trash`、`attachments`、`browserCards`、`todoLists`、`manualTasks`

### IPC 通信

- Handler 注册在 `electron/ipc/index.ts`
- 独立 handler：`storageHandlers.ts`、`aiHandlers.ts`、`syncHandlers.ts`、`knowledgeHandlers.ts`、`logHandlers.ts`、`configHandlers.ts`
- 渲染进程到主进程使用 preload 的 `invoke`

### 注释

- 为中文开发者使用中文注释
- 公共 API 和复杂函数使用 JSDoc
- 代码中避免不必要的注释
- 大文件使用 `// ============ Section ============` 分区

### CSS/样式

- 组件特定样式放在组件同目录的 `.css` 文件
- 全局样式在 `src/index.css`
- Ant Design 主题在 `src/theme/`

## 核心模块

### 功能模块 (`src/features/`)

| 模块                | 说明                   |
| ------------------- | ---------------------- |
| `ai-chat`           | AI 对话窗口            |
| `ai-workbench`      | AI 工作台              |
| `browser`           | 浏览器卡片             |
| `editor`            | 富文本编辑器（Tiptap） |
| `layout`            | 布局组件               |
| `note`              | 笔记管理               |
| `selection-toolbar` | 选中文本工具栏         |
| `settings`          | 设置页面               |
| `todo`              | 待办事项               |

### 公共组件 (`src/components/`)

- `AppBackground` - 应用背景
- `BaseCard` / `BaseFloatingWindow` / `BasePillWindow` - 基础窗口组件
- `FloatingNoteWindow` / `FloatingTodoWindow` - 浮动窗口
- `PillWindow` / `TodoPillWindow` - 药丸窗口
- `UpdateNotifier` - 更新通知
- `WelcomeScreen` - 欢迎页

### 知识库模块 (`electron/knowledge/`)

向量检索系统，支持笔记内容的语义搜索：

- `embedding.ts` - 文本嵌入
- `vectorStore.ts` - 向量存储
- `knowledgeIndex.ts` - 知识索引

### 同步模块 (`electron/sync/`)

WebDAV 同步系统：

- `syncManager.ts` - 同步管理器
- `syncEngine.ts` - 同步引擎
- `webdavClient.ts` - WebDAV 客户端
- 支持冲突检测与解决（默认保留最新修改）

## 重要文件位置

| 文件                                 | 说明         |
| ------------------------------------ | ------------ |
| `electron/main.ts`                   | 主进程入口   |
| `electron/storage/StorageManager.ts` | 存储管理器   |
| `electron/preload.ts`                | 预加载脚本   |
| `src/main.tsx`                       | 渲染进程入口 |
| `src/store/`                         | 应用状态     |
| `electron/config.ts`                 | 配置         |
| `electron/windows/`                  | 窗口管理     |
| `electron/ai/`                       | AI 适配器    |

## 测试

- 测试框架：Vitest
- 测试环境：jsdom
- 设置文件：`src/test/setup.ts`
- 测试目录：`src/**/*.test.ts`、`tests/`

```bash
# 运行所有测试
npm run test:run

# 带覆盖率
npm run test:coverage

# 带 UI 界面
npm run test:ui
```

## 主要依赖

### 核心框架

- React 18 + TypeScript 5
- Electron 30
- Vite 7

### UI 组件

- Ant Design 6
- Radix UI（下拉菜单、弹出框）
- Lucide React（图标）

### 编辑器

- Tiptap（富文本编辑）

### AI

- @ant-design/x（AI 组件）

### 数据存储

- better-sqlite3 + sqlite-vec（向量搜索）

### 状态管理

- Zustand 5

## Git Hooks

项目使用 Husky + lint-staged：

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```
