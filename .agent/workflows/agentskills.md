---
description: InfinityNoteX 项目开发指南 - 架构、IPC 通信、功能开发规范
---

# InfinityNoteX 开发指南

## 1. 项目架构概述

```
infinitynotex/
├── electron/                 # Main Process（主进程）
│   ├── main.ts              # 入口文件，生命周期管理
│   ├── preload.ts           # 预加载脚本，暴露 API 给渲染进程
│   ├── config.ts            # 统一配置管理
│   ├── ipc/                  # IPC 处理器模块
│   │   ├── index.ts         # 统一导出
│   │   ├── storageHandlers.ts
│   │   ├── syncHandlers.ts
│   │   ├── aiHandlers.ts
│   │   ├── configHandlers.ts
│   │   ├── knowledgeHandlers.ts
│   │   └── logHandlers.ts
│   ├── storage/             # 数据存储层
│   ├── windows/             # 窗口管理
│   ├── sync/                # 数据同步
│   └── knowledge/           # 知识库/向量搜索
│
├── src/                     # Renderer Process（渲染进程）
│   ├── features/            # 功能模块（按领域划分）
│   │   ├── note/           # 便签功能
│   │   ├── ai-chat/        # AI 对话
│   │   ├── settings/       # 设置页面
│   │   └── ...
│   ├── store/               # Zustand 状态管理
│   │   ├── slices/         # 状态切片
│   │   └── settingsStore.ts
│   ├── components/          # 通用组件
│   ├── shared/              # 共享代码
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 共享类型
│   └── services/            # 服务层（类型定义 + AI 配置）
│
└── tests/                   # 测试文件
```

### 1.1 `src/services/` 目录说明（重要！）

> **架构决策（2026-01）**：已删除传声筒 Service（`noteService.ts`、`folderService.ts` 等）。
> 组件和 Store 直接调用 `window.storage` / `window.ai` 等 IPC API。

**当前保留的文件及用途：**

| 文件                    | 用途           | 说明                                              |
| :---------------------- | :------------- | :------------------------------------------------ |
| `types.ts`              | 业务类型定义   | Note, Folder, AIConversation, TodoList 等核心类型 |
| `aiConfig.ts`           | AI 配置类型    | ChatMessage, ChatPayload, ConnectionTestResult 等 |
| `aiProviders.ts`        | AI 提供商预设  | DeepSeek, 阿里云, OpenAI 等提供商配置常量         |
| `aiConfigStore.ts`      | AI 配置管理    | 配置读取/保存逻辑（有实际业务逻辑）               |
| `embeddingProviders.ts` | 向量嵌入提供商 | 各 embedding 服务的配置                           |
| `knowledgeTypes.ts`     | 知识库类型     | 知识库搜索结果等类型定义                          |
| `index.ts`              | 统一导出       | 重新导出上述模块                                  |

**使用规范：**

```typescript
// ✅ 正确：从 services 导入类型
import type { Note, Folder, AIConversation } from '@/services/types';
import type { ChatMessage, ChatPayload } from '@/services/aiConfig';
import { AI_PROVIDERS } from '@/services/aiProviders';

// ✅ 正确：直接调用 IPC API（不经过 Service 层）
const notes = await window.storage.listNotes(folderId);
const folders = await window.storage.listFolders();
await window.ai.chat(payload);

// ❌ 错误：不要再创建传声筒 Service
// class NoteService { listNotes() { return window.storage.listNotes(); } }
```

## 2. IPC 通信规范（重要！）

### 2.1 架构现状与设计决策

**当前统计（2026-01）：**

- IPC 方法总数：约 93 个
- preload.ts 行数：322 行
- sandbox 模式：默认启用 ✅（安全）

**为什么不使用 tRPC/interprocess 等方案？**

| 方案            | 评估结果                                   |
| :-------------- | :----------------------------------------- |
| `electron-trpc` | ❌ 有性能开销，对简单 getter/setter 不划算 |
| `interprocess`  | ❌ 需要 `sandbox: false`，降低安全性       |
| 自定义代码生成  | ⏸️ 开发成本高，当前规模暂不需要            |

**结论**：当前方案（手动维护方法白名单）已足够，迁移成本大于收益。

### 2.2 核心约束

**Electron contextBridge 不支持 Proxy 对象**，必须使用显式方法列表。

这意味着无法通过 `new Proxy()` 动态生成 IPC 方法，必须在 `preload.ts` 中显式列出所有方法名。

### 2.3 添加新 IPC API 的完整步骤

添加一个新的 IPC API 需要修改 **3 个文件**：

```
1. electron/ipc/xxxHandlers.ts    → 注册 IPC 处理器
2. electron/preload.ts            → 添加到方法白名单
3. src/vite-env.d.ts              → 添加 TypeScript 类型声明
```

#### 完整示例：添加 `storage:getNoteTags` 方法

**步骤 1：在 `electron/ipc/storageHandlers.ts` 注册处理器**

```typescript
// electron/ipc/storageHandlers.ts
export function registerStorageHandlers(): void {
  // ... 其他处理器

  // ============ 新增：获取便签标签 ============
  ipcMain.handle('storage:getNoteTags', async (_, noteId: string) => {
    const note = await storageManager.notes.get(noteId);
    return note?.tags ?? [];
  });
}
```

**步骤 2：在 `electron/preload.ts` 添加方法名**

```typescript
// electron/preload.ts
const STORAGE_METHODS = [
  'getDefaultPath',
  'getCurrentPath',
  // ... 其他已有方法
  'getNoteTags', // ← 新增
];
```

**步骤 3：在 `src/vite-env.d.ts` 添加类型声明**

```typescript
// src/vite-env.d.ts
interface Window {
  storage: {
    // ... 其他方法
    getNoteTags(noteId: string): Promise<string[]>; // ← 新增
  };
}
```

**步骤 4：在渲染进程中调用**

```typescript
// src/features/note/hooks/useNoteTags.ts
const tags = await window.storage.getNoteTags(noteId);
```

### 2.4 关键文件对照表

| 模块       | IPC 前缀        | Handler 文件                | preload 常量            | 类型声明位置    |
| :--------- | :-------------- | :-------------------------- | :---------------------- | :-------------- |
| 存储       | `storage`       | `storageHandlers.ts`        | `STORAGE_METHODS`       | `vite-env.d.ts` |
| 存储事件   | `storageEvents` | `storageHandlers.ts`        | N/A (Manual)            | `vite-env.d.ts` |
| 同步       | `sync`          | `syncHandlers.ts`           | `SYNC_METHODS`          | `vite-env.d.ts` |
| AI         | `ai`            | `aiHandlers.ts`             | `AI_METHODS`            | `electron.d.ts` |
| 配置       | `config`        | `configHandlers.ts`         | `CONFIG_METHODS`        | `vite-env.d.ts` |
| 知识库     | `knowledge`     | `knowledgeHandlers.ts`      | `KNOWLEDGE_METHODS`     | `electron.d.ts` |
| 日志       | `log`           | `logHandlers.ts`            | `LOG_METHODS`           | `vite-env.d.ts` |
| 悬浮窗     | `floating`      | `windows/floatingWindow.ts` | `FLOATING_METHODS`      | `vite-env.d.ts` |
| Todo悬浮窗 | `floatingTodo`  | `windows/floatingWindow.ts` | `FLOATING_TODO_METHODS` | `vite-env.d.ts` |
| 统一配置   | `app`           | `configHandlers.ts`         | `APP_METHODS`           | `vite-env.d.ts` |
| 浏览器卡片 | `browserCards`  | `storageHandlers.ts`        | `BROWSER_CARDS_METHODS` | `vite-env.d.ts` |
| 附件       | `attachments`   | `storageHandlers.ts`        | `ATTACHMENTS_METHODS`   | `electron.d.ts` |
| 应用信息   | `appInfo`       | `main.ts`                   | N/A (Manual)            | `vite-env.d.ts` |
| 自动更新   | `autoUpdater`   | `main.ts`                   | N/A (Manual)            | `vite-env.d.ts` |

### 2.5 带事件监听的 IPC（进阶）

如果需要从 Main 向 Renderer 推送事件，需要额外处理：

```typescript
// electron/preload.ts - 带事件监听的 API
contextBridge.exposeInMainWorld(
  'sync',
  createProxy(ipcRenderer, 'sync', SYNC_METHODS, {
    // 额外的事件监听方法（不在 SYNC_METHODS 中）
    onProgress: (callback: (progress: unknown) => void) => {
      const listener = (_: unknown, progress: unknown) => callback(progress);
      ipcRenderer.on('sync:progress', listener);
      return () => ipcRenderer.removeListener('sync:progress', listener);
    },
  }),
);
```

### 2.6 常见错误排查

| 错误现象                                           | 可能原因                      | 解决方案                                    |
| :------------------------------------------------- | :---------------------------- | :------------------------------------------ |
| `window.xxx.method is not a function`              | 方法名未添加到 preload 白名单 | 检查 `preload.ts` 是否包含该方法            |
| TypeScript 报错 `Property 'method' does not exist` | 类型声明未更新                | 更新 `vite-env.d.ts` 或 `electron.d.ts`     |
| IPC 调用无响应                                     | Handler 未注册                | 检查 `ipcMain.handle` 是否正确调用          |
| IPC 调用返回 `undefined`                           | 方法名拼写不一致              | 确保 handler/preload/调用处的方法名完全一致 |

## 3. 功能开发指南

### 3.1 添加新的设置项

1. **定义配置类型**：`src/shared/types/config.ts` 中的 `AppConfig`
2. **添加 IPC**：`electron/ipc/configHandlers.ts`
3. **更新 preload**：`electron/preload.ts` 中的方法列表
4. **创建 UI**：`src/features/settings/tabs/` 下创建 Tab 组件
5. **添加状态**：`src/store/slices/` 下创建或更新 Slice

### 3.2 添加新的存储实体

1. 在 `electron/storage/` 下创建 `XxxStorage.ts`
2. 在 `electron/storage/index.ts` 中注册到 `storageManager`
3. 在 `electron/ipc/storageHandlers.ts` 添加 IPC 处理器
4. 更新 `electron/preload.ts` 的 `STORAGE_METHODS`
5. 更新 `src/vite-env.d.ts` 的类型声明

### 3.3 添加新窗口类型

1. 在 `electron/windows/` 下创建窗口模块
2. 在 `electron/main.ts` 中注册 IPC 处理器
3. 更新 `electron/preload.ts` 暴露 API
4. 在 `src/App.tsx` 的路由中添加对应页面

## 4. 代码规范

### 4.1 命名约定

- **IPC 通道**：`模块:方法名`（如 `storage:createNote`）
- **Store Slice**：`xxxSlice.ts`，导出 `createXxxSlice`
- **组件**：PascalCase，如 `NoteEditor.tsx`
- **工具函数**：camelCase，如 `deepMerge.ts`

### 4.2 类型规范

- 共享类型放在 `src/shared/types/` (如 `config.ts`, `sync.ts`)
- 窗口 API 类型声明在 `src/vite-env.d.ts`
- 避免使用 `any`，使用 `unknown` + 类型守卫

### 4.3 测试

- 单元测试放在 `src/**/__tests__/` 目录
- 运行测试：`npm run test:run`
- 运行覆盖率：`npm run test:coverage`

## 5. 常用命令

```bash
npm run dev          # 开发模式
npm run web:build    # 构建（含 tsc 检查）
npm run test:run     # 运行测试
npm run lint:fix     # 修复 ESLint 问题
npx tsc --noEmit     # TypeScript 类型检查
```

## 6. 已知注意事项

1. **contextBridge 限制**：不能使用 `Proxy`，必须显式列出方法
2. **配置持久化**：使用 `electron/config.ts` 的 `readAppConfig`/`writeAppConfig`
3. **存储路径**：用户数据在 `~/Library/Application Support/infinitynotex/`
4. **热重载**：修改 `electron/` 下文件会触发 Main Process 重建
