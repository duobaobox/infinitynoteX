# AGENTS.md - InfinityNoteX 开发手册

本文档为在 InfinityNoteX 代码库中工作的 AI 代理提供系统化开发指南。

适用目标：

- 快速理解项目分层与运行方式
- 在正确位置实现新功能，而不是“哪里能改就先改哪里”
- 降低跨 Renderer / preload / IPC / main / storage 改动时的漏改风险

## 项目速览

**InfinityNoteX** 是一款基于 **Electron + React + TypeScript** 的跨平台笔记应用，当前版本 `1.1.1`。

核心能力包括：

- 富文本编辑器（Tiptap）
- AI 对话与 AI 工作台
- WebDAV 同步
- 向量知识库检索
- 浮动窗口 / 药丸窗口
- 本地文件存储 + 部分索引能力

技术栈概览：

- Renderer：React 18 + Ant Design 6 + Zustand 5
- Desktop：Electron 30
- Build：Vite 7 + vite-plugin-electron
- Editor：Tiptap 3
- Storage：better-sqlite3 + sqlite-vec + 本地文件系统
- Test：Vitest + jsdom + Testing Library

## 阅读优先级

开始开发前，优先参考以下文件，而不是只看 README：

1. `AGENTS.md`（本文件）
2. `src/App.tsx`：应用入口、窗口模式、启动副作用
3. `src/config/featureRegistry.tsx`：功能注册机制
4. `src/store/workspaceStore.ts` / `src/store/settingsStore.ts`：状态组织方式
5. `electron/preload.ts`：Renderer 可用能力边界
6. `src/shared/types/ipc.ts`：IPC 契约单一来源
7. `electron/ipc/*.ts`：主进程能力暴露方式
8. `electron/storage/StorageManager.ts` 与 `electron/storage/core/moduleRegistry.ts`

注意：

- `README.md` 含有模板残留内容，不应视为最权威的架构说明。
- 优先相信当前源码结构和本文件。

## 一图理解架构

```text
Renderer (src/)
  ├─ App / Features / Components
  ├─ Zustand stores
  ├─ 通过 window.* 调用桌面能力
  ▼
preload (electron/preload.ts)
  ├─ contextBridge 暴露 window.storage / window.ai / window.sync / ...
  ├─ 使用 createProxy 统一生成 invoke API
  ▼
IPC Handlers (electron/ipc/*.ts)
  ├─ storageHandlers
  ├─ aiHandlers
  ├─ syncHandlers
  ├─ knowledgeHandlers
  ├─ configHandlers / logHandlers
  ▼
Main Services (electron/)
  ├─ storage
  ├─ ai
  ├─ sync
  ├─ knowledge
  ├─ windows
  ▼
Data / Native Capabilities
  ├─ 本地文件
  ├─ better-sqlite3 / sqlite-vec
  ├─ Electron 窗口能力
  └─ WebDAV / 外部 AI / Embedding
```

开发原则：

- Renderer 不直接访问 Node.js / 文件系统，统一经由 preload + IPC。
- 新能力优先做成“领域模块”，避免把逻辑直接堆进组件。
- 类型与契约优先收敛到共享层，避免主渲染进程方法名漂移。

## 目录地图

### Renderer 侧

```text
src/
├── App.tsx                     # 应用入口，窗口模式切换
├── main.tsx                    # 渲染入口
├── components/                 # 跨功能复用组件
├── config/featureRegistry.tsx  # Feature 注册中心
├── features/                   # 业务功能模块
│   ├── note/
│   ├── ai-workbench/
│   ├── browser/
│   ├── todo/
│   ├── editor/
│   ├── settings/
│   └── layout/
├── store/                      # Zustand stores 与 slices
├── shared/                     # 共享类型、IPC 契约、通用工具
├── services/                   # 渲染侧服务与业务类型
├── hooks/                      # 通用 hooks
└── theme/                      # 主题与 Ant Design 配置
```

### Electron 主进程侧

```text
electron/
├── main.ts                     # 主进程入口
├── preload.ts                  # contextBridge 能力暴露
├── ipc/                        # IPC handlers
├── windows/                    # 主窗体、悬浮窗、AI 窗口管理
├── storage/                    # 本地数据存储主模块
├── sync/                       # WebDAV 同步
├── knowledge/                  # 向量知识库
├── ai/                         # AI 适配器
├── config.ts                   # 配置读写
├── logger.ts                   # 日志
└── updater.ts                  # 自动更新
```

## 运行模型

### 应用启动

主流程大致如下：

1. `electron/main.ts` 初始化应用生命周期
2. 迁移旧配置
3. 初始化 `storageManager`
4. 注册所有 IPC handlers
5. 创建主窗口
6. 初始化自动更新、菜单、主题同步、全局快捷键

### Renderer 启动

主界面入口在 `src/App.tsx`，它负责：

- 导入并注册所有 Feature
- 初始化工作区数据（folders、AI conversations）
- 监听同步完成后的数据刷新
- 处理悬浮窗口跳转回主窗口
- 根据 hash 决定当前窗口类型

### 窗口模式

当前存在多种窗口模式，基于 `window.location.hash` 判断：

- `main`
- `floating`
- `pill`
- `floating-todo`
- `todo-pill`
- `ai-chat-window`

如果新增独立窗口类型，通常要同时修改：

- `electron/windows/*`
- `src/App.tsx`
- 必要时补充 preload / IPC 能力

## Feature 架构

### 当前 Feature 注册机制

本项目不是把每个页面硬编码在 Layout 中，而是使用注册表：

- 每个 Feature 在自己的 `index.tsx` 中调用 `registerFeature(...)`
- `src/features/registerAllFeatures.ts` 集中导入这些模块，触发注册副作用
- `Sidebar` / `ListPanel` / `EditorPanel` 再根据当前 workspaceView 与选中项动态渲染

### Workspace 模型

当前一级工作区只有两类：

- `note`
- `tool`

这意味着：

- 新增“工具型”能力最简单，通常挂到 `tool`
- 如果要新增第三种一级空间，需要调整 `featureRegistry.tsx`、`Sidebar`、`App.tsx` 等

### 新增一个工具型 Feature 的标准做法

推荐结构：

```text
src/features/your-feature/
├── index.tsx
└── views/
    ├── YourListView/
    └── YourEditorView/
```

步骤：

1. 创建 Feature 目录与视图组件
2. 在 `index.tsx` 中调用 `registerFeature`
3. 在 `src/features/registerAllFeatures.ts` 中导入该 Feature
4. 如果该功能有全局状态，给 `workspaceStore` 新增 slice
5. 如果需要本地数据或主进程能力，再补 IPC / storage

适用场景：

- 新工具页
- 新工作台
- 新列表 + 编辑器组合视图

## 状态管理约定

### 两个主 Store

项目状态分成两套：

- `src/store/workspaceStore.ts`
  - 管主工作区运行时状态
  - 如：folders、notes、AI conversations、browser cards、todo、workspaceView、UI 折叠状态
- `src/store/settingsStore.ts`
  - 管设置页相关状态
  - 如：appearance、AI config、storage、sync、app、knowledge

不要把所有状态都塞进一个 store。

判断规则：

- “当前界面运行时选择态/展示态” 放 `workspaceStore`
- “设置中心配置态” 放 `settingsStore`

### Slice 模式

所有全局状态应优先使用 slice 扩展，而不是在组件中堆大段 `useState`。

推荐步骤：

1. 在 `src/store/slices/` 下新增或扩展 slice
2. 在 `src/store/slices/index.ts` 导出
3. 在 `workspaceStore.ts` 或 `settingsStore.ts` 组合
4. 必要时在 `src/store/selectors/` 中增加 selector

### 选择器与副作用

- 组件里优先使用 selector 获取单个字段，减少重渲染
- 像“选中文件夹后自动加载 notes”这种跨状态副作用，优先放 store 附近的辅助函数里，而不是埋进多个组件

## IPC 开发约定

### IPC 是共享契约，不是临时字符串

本项目已经把 IPC 方法名集中在：

- `src/shared/types/ipc.ts`

不要在组件里直接手写 `'storage:xxx'` 这类字符串。

### 新增一个 IPC 方法时，通常要补这几处

如果是普通 proxy 方法，按下面顺序补：

1. `src/shared/types/ipc.ts`
   - 在 `IPC_PROXY_METHODS` 里增加方法
2. `electron/preload.ts`
   - 一般不用手写，只要该 namespace 走 `createProxy` 就能自动暴露
   - 如果有事件订阅或特殊方法，需手动 override
3. `electron/ipc/<domain>Handlers.ts`
   - 注册 `ipcMain.handle(...)`
4. `src/vite-env.d.ts`
   - 补充 `window.xxx` 类型声明
5. 必要时补对应服务 / store 调用

最常见漏点：

- 忘记更新 `src/vite-env.d.ts`
- 忘记把事件型 API 加到 preload override
- 方法名在主渲染进程不一致

### 什么时候不用 proxy

以下情况通常需要手写：

- 流式事件回调
- `onXxx` / `offXxx` 订阅型 API
- 需要 send + 事件回传的能力

例如：

- AI 流式输出
- sync 进度监听
- storage event 监听

## Storage 开发约定

### 存储设计

本项目采用“文件存储 + 索引/辅助数据库”的混合方案。

核心入口：

- `electron/storage/StorageManager.ts`
- `electron/storage/core/moduleRegistry.ts`

当前主要模块：

- folders
- notes
- ai
- trash
- attachments
- browserCards
- todoLists
- manualTasks

### 新增一个存储模块时的推荐路径

如果功能需要持久化新实体，推荐流程：

1. 在 `electron/storage/schemas.ts` 定义 schema
2. 在 `electron/storage/core/moduleRegistry.ts` 注册模块配置
3. 如果只是常规 CRUD，可考虑复用 `BaseStorage`
4. 如果有特殊逻辑，新增独立存储类
5. 在 `StorageManager.ts` 注入新模块
6. 在 `electron/ipc/storageHandlers.ts` 或新的 handler 中暴露能力
7. 在 `src/shared/types/ipc.ts` 与 `src/vite-env.d.ts` 补契约
8. 在对应 store / feature 中接入

### 是否参与同步

是否需要 WebDAV 同步，由模块配置决定。

判断建议：

- 用户核心数据：通常应支持同步
- 临时 UI 状态、本地工作缓存、窗口状态：通常不应同步
- AI 对话、浏览器卡片、todo 清单目前偏本地专用实现，要谨慎改同步策略

### 删除策略

注意不是所有实体都“硬删除”：

- Note 删除默认先进回收站
- Todo / BrowserCard / AIConversation 的删除语义与 Note 不同

设计新模块时，先确定：

- 是否需要 soft delete
- 是否要生成 excerpt
- 是否参与索引
- 是否参与同步

## 编辑器扩展开发约定

富文本编辑器位于：

- `src/features/editor/`

扩展被拆分成多个模块：

- `basic.ts`
- `formatting.ts`
- `content.ts`
- `task.ts`
- `enhancements.ts`
- `markdown.ts`

统一装配入口：

- `src/features/editor/extensions/index.ts`

### 适合放到 editor/extensions 的改动

- 新节点 / mark
- Slash 命令
- 粘贴处理
- 图片、表格、任务列表增强
- 编辑器行为增强

### 不适合直接塞进编辑器核心的改动

- 与业务实体强耦合的大量状态逻辑
- 与具体 feature 绑定的列表 / 面板逻辑

原则：

- 编辑器做“编辑能力”
- 业务模块做“业务流程”

## AI、知识库、同步模块

### AI

主路径：

- Renderer：`src/features/ai-chat/`、`src/features/ai-workbench/`
- Main：`electron/ai/`
- IPC：`electron/ipc/aiHandlers.ts`

适合扩展：

- 新 Provider 适配
- 新流式交互行为
- Prompt 组装
- 与 note / knowledge 的联动

### 知识库

主路径：

- `electron/knowledge/embedding.ts`
- `electron/knowledge/vectorStore.ts`
- `electron/knowledge/knowledgeIndex.ts`
- `electron/ipc/knowledgeHandlers.ts`

适合扩展：

- 检索策略
- 分块策略
- 增量索引
- embedding provider

### 同步

主路径：

- `electron/sync/syncManager.ts`
- `electron/sync/syncEngine.ts`
- `electron/sync/webdavClient.ts`

注意：

- 当前实现明显以 WebDAV 为主
- 新增同步提供商不是简单“加个配置页”即可，往往还要改 manager / engine 抽象

## 常见开发任务与推荐落点

### 1. 新增一个纯前端面板或交互

优先改：

- `src/features/<feature>/views/*`
- 必要时增加局部 hook

通常不需要碰：

- preload
- IPC
- storage

### 2. 新增一个工具页

优先改：

- `src/features/<new-tool>/index.tsx`
- `src/features/<new-tool>/views/*`
- `src/features/registerAllFeatures.ts`
- `workspaceStore` 对应 slice

### 3. 新增一个桌面能力

例如：

- 打开系统目录
- 新窗口行为
- 原生对话框
- 文件导入导出

优先改：

- `electron/ipc/*Handlers.ts`
- `src/shared/types/ipc.ts`
- `electron/preload.ts`
- `src/vite-env.d.ts`

### 4. 新增一个持久化实体

优先改：

- `electron/storage/schemas.ts`
- `electron/storage/core/moduleRegistry.ts`
- `electron/storage/<NewEntity>Storage.ts`
- `electron/storage/StorageManager.ts`
- 对应 IPC 与 store

### 5. 新增编辑器节点或菜单

优先改：

- `src/features/editor/extensions/*`
- `src/features/editor/menus/*`
- 必要时修改 `TipTapEditor.tsx`

### 6. 新增设置项

先判断归属：

- 如果是应用配置：走 `settingsStore` + `window.app` / `window.config`
- 如果是临时界面状态：走 `workspaceStore`

## 代码风格规范

### TypeScript

- 启用严格模式
- 启用 `noUnusedLocals` 和 `noUnusedParameters`
- 函数参数和返回值尽量显式
- 避免 `any`，优先 `unknown`、泛型或更具体类型

### Prettier

项目使用如下格式约定：

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

- 外部库
- 内部模块
- 类型定义

示例：

```typescript
import { useEffect } from 'react';
import { storageManager } from '../storage';
import type { Note } from '../types';
```

### 文件命名

- React 组件：PascalCase
- Hook：`use*`
- 工具/模块：camelCase
- 样式：与组件同名或语义匹配
- 测试：`*.test.ts` / `*.test.tsx`

### 注释

- 以中文注释为主，方便团队维护
- 公共 API、复杂流程、边界条件可加 JSDoc
- 避免“解释显而易见代码”的注释
- 大文件可用 `// ============ Section ============` 分区

## Renderer 侧约束

- 不要直接在 Renderer 中使用 Node.js API
- 不要绕过 preload 直接假设 Electron 全局对象可用
- 不要在多个组件重复发起同一加载逻辑，优先抽到 store action 或共享 hook
- 组件应聚焦展示与交互，持久化逻辑尽量下沉

## Main 侧约束

- IPC handler 只做参数整理、调度与边界处理
- 复杂逻辑下沉到 `storage` / `sync` / `knowledge` / `ai` 等领域模块
- 不要把大段业务逻辑塞进 `electron/main.ts`
- 新增能力优先归类到已有 handler，不随意新建“杂项 handler”

## 测试与验证

项目使用：

- Vitest
- jsdom
- Testing Library

测试目录：

- `src/**/*.{test,spec}.{ts,tsx}`
- `tests/**/*.{test,spec}.{ts,tsx}`

推荐命令：

```bash
# 全量测试
npm run test:run

# 运行单个测试文件
npm run test:run -- tests/unit/main/storage/storageManager.test.ts

# 覆盖率
npm run test:coverage

# Lint
npm run lint

# 格式检查
npm run format:check
```

开发时的最小验证建议：

- 改 store：至少跑对应 store / hook 测试
- 改 storage：至少跑 `tests/unit/main/storage/*`
- 改 IPC 契约：跑相关单测并手工验证 renderer 调用
- 改编辑器：做最少一次手工编辑流程验证
- 改同步 / 知识库：除单测外，尽量手工走一遍关键路径

## 构建命令

```bash
# 开发
npm run dev

# Web 构建
npm run web:build

# Electron 打包
npm run build
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux
npm run electron:build:all

# 原生模块重建
npm run rebuild
```

## 关键文件清单

| 文件                                      | 作用                          |
| ----------------------------------------- | ----------------------------- |
| `src/App.tsx`                             | 应用主入口与窗口模式判断      |
| `src/config/featureRegistry.tsx`          | Feature 注册中心              |
| `src/features/registerAllFeatures.ts`     | Feature 统一注册入口          |
| `src/store/workspaceStore.ts`             | 工作区状态                    |
| `src/store/settingsStore.ts`              | 设置状态                      |
| `src/shared/types/ipc.ts`                 | IPC 契约单一来源              |
| `electron/preload.ts`                     | 暴露给 Renderer 的 bridge API |
| `electron/ipc/index.ts`                   | IPC barrel export             |
| `electron/ipc/storageHandlers.ts`         | 存储与部分 CRUD IPC           |
| `electron/storage/StorageManager.ts`      | 存储总入口                    |
| `electron/storage/core/moduleRegistry.ts` | 存储模块注册中心              |
| `electron/sync/syncManager.ts`            | 同步总入口                    |
| `electron/knowledge/knowledgeIndex.ts`    | 知识库索引逻辑                |

## 常见坑位

### 1. 新增 Feature 但界面没出现

通常是忘了：

- 在 `index.tsx` 调用 `registerFeature`
- 在 `src/features/registerAllFeatures.ts` 导入

### 2. Renderer 调不到新 API

通常是忘了：

- 更新 `src/shared/types/ipc.ts`
- 更新 `src/vite-env.d.ts`
- preload 中补特殊 override
- 主进程注册对应 handler

### 3. 状态放错地方

常见误区：

- 把设置项放进 `workspaceStore`
- 把一次性 UI 展示态写入持久化配置

### 4. 在组件里直接做重逻辑

症状：

- 组件里出现大段存储、同步、数据迁移逻辑

正确做法：

- 下沉到 store / service / storage / main domain

### 5. 误把本地专用数据改成同步数据

修改同步策略前，先确认：

- 是否存在跨设备语义
- 是否会引入冲突合并问题
- 是否与当前 WebDAV 同步结构兼容

## 推荐工作流

在实现一个新功能时，按如下顺序思考：

1. 这是纯前端能力，还是需要主进程 / 本地存储？
2. 它属于已有 Feature，还是应该是新 Feature？
3. 状态是工作区运行时状态，还是设置配置？
4. 是否需要 IPC？
5. 是否需要持久化？
6. 是否需要同步？
7. 是否需要补测试？

如果答案涉及多个层级，优先从“共享契约与领域边界”开始设计，再写 UI。

## 提交前检查清单

- 相关类型是否已补齐
- IPC 契约是否主渲染一致
- 新 Feature 是否已注册
- 新 store slice 是否已组合导出
- 新存储模块是否已在 manager 中注入
- 相关测试是否通过
- `npm run lint` 是否通过
- 注释和命名是否符合中文团队维护习惯

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

这意味着：

- 小改动也应尽量保持可格式化
- 不要依赖“先提交再修”

## 最后建议

对 InfinityNoteX 来说，最稳定的开发方式不是“直接改能工作的地方”，而是：

1. 先判断归属层级
2. 再走对应标准路径
3. 最后补类型、测试和验证

如果遵守本文件的路径约定，新增功能通常会比较顺；如果跳过 preload / IPC / store / storage 的边界设计，后续维护成本会快速上升。
