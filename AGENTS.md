# AGENTS.md - InfinityNoteX 开发指南

本文档为在 InfinityNoteX 代码库中工作的 AI 代理提供指导方针和命令。

## 构建命令

```bash
# 开发
npm run dev                    # 启动 Vite 开发服务器（端口 1997）

# 构建
npm run build                  # 构建 Electron 应用（electron:build 的别名）
npm run web:build              # 构建 Web 版本（tsc && vite build）
npm run electron:build:win     # 构建 Windows 版本
npm run electron:build:mac     # 构建 macOS 版本
npm run electron:build:linux   # 构建 Linux 版本
npm run electron:build:all     # 构建所有平台（需要 bash）

# 代码检查与格式化
npm run lint                   # 运行 ESLint
npm run lint:fix               # 运行 ESLint 并自动修复
npm run format                 # 运行 Prettier（写入所有）
npm run format:check           # 检查 Prettier 格式化

# 测试
npm run test                   # 运行测试（vitest --ui，带 UI）
npm run test:run               # 运行测试（vitest run，无头模式）
npm run test:coverage          # 运行测试并生成覆盖率报告

# 单个测试文件
npm run test:run -- src/hooks/useNoteCardTheme.test.ts

# 原生模块（Node.js 升级后）
npm run rebuild                # 重建 better-sqlite3, sqlite-vec
```

## 代码风格规范

### TypeScript

- `tsconfig.json` 中启用严格模式
- 启用 `noUnusedLocals` 和 `noUnusedParameters`
- 函数参数和返回值使用显式类型
- 避免使用 `any`；使用 `unknown` 或更具体的类型

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
- 独立 handler：`storageHandlers.ts`、`aiHandlers.ts`、`syncHandlers.ts` 等
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

### 重要文件位置

- 主进程入口：`electron/main.ts`
- 存储管理器：`electron/storage/StorageManager.ts`
- 渲染进程入口：`src/main.tsx`
- 应用状态：`src/store/`
- 配置：`electron/config.ts`
- 窗口管理：`electron/windows/`
