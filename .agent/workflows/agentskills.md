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
│   └── services/            # 服务层
│
└── tests/                   # 测试文件
```

## 2. IPC 通信规范（重要！）

### 2.1 核心约束

**contextBridge 不支持 Proxy 对象**，必须使用显式方法列表。

### 2.2 添加新 IPC 通道的步骤

#### 步骤 1：在 `electron/ipc/xxxHandlers.ts` 注册处理器

```typescript
// 示例：electron/ipc/storageHandlers.ts
ipcMain.handle('storage:newMethod', async (_, arg1: string) => {
  return await storageManager.newMethod(arg1);
});
```

#### 步骤 2：在 `electron/preload.ts` 添加方法名

```typescript
const STORAGE_METHODS = [
  // ... 现有方法
  'newMethod', // 添加新方法名
];
```

#### 步骤 3：在 `src/vite-env.d.ts` 添加类型声明

```typescript
interface Window {
  storage: {
    // ... 现有方法
    newMethod(arg1: string): Promise<ReturnType>;
  };
}
```

### 2.3 关键文件对照表

| 模块     | IPC 前缀    | Handler 文件           | preload 常量        |
| -------- | ----------- | ---------------------- | ------------------- |
| 存储     | `storage`   | `storageHandlers.ts`   | `STORAGE_METHODS`   |
| 同步     | `sync`      | `syncHandlers.ts`      | `SYNC_METHODS`      |
| AI       | `ai`        | `aiHandlers.ts`        | `AI_METHODS`        |
| 配置     | `config`    | `configHandlers.ts`    | `CONFIG_METHODS`    |
| 知识库   | `knowledge` | `knowledgeHandlers.ts` | `KNOWLEDGE_METHODS` |
| 日志     | `log`       | `logHandlers.ts`       | `LOG_METHODS`       |
| 悬浮窗   | `floating`  | `floatingWindow.ts`    | `FLOATING_METHODS`  |
| 统一配置 | `app`       | `configHandlers.ts`    | `APP_METHODS`       |

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

- 共享类型放在 `src/shared/types/`
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
