# InfinityNoteX

InfinityNoteX 是一款基于 **Electron + React + TypeScript** 的跨平台笔记应用，当前版本为 `1.1.1`。

它以“本地优先”的桌面体验为核心，围绕笔记、AI、知识库、同步与悬浮工作流构建，适合需要在桌面端持续记录、整理、检索和延展思考的使用场景。

## 核心特性

- 富文本编辑器：基于 Tiptap，支持任务列表、图片、代码块、表格、Markdown 粘贴增强等
- AI 对话与工作台：支持独立 AI 对话窗口与工作台式交互
- 向量知识库：支持对笔记内容进行语义检索
- WebDAV 同步：支持跨设备同步本地数据
- 浮动窗口 / 药丸窗口：便签与任务可钉住为独立窗口
- 本地存储：支持备份、恢复、迁移与健康检查

## 技术栈

- Renderer：React 18、Ant Design 6、Zustand 5
- Desktop：Electron 30
- Build：Vite 7、vite-plugin-electron、electron-builder
- Editor：Tiptap 3
- Storage：better-sqlite3、sqlite-vec、本地文件系统
- Test：Vitest、Testing Library、jsdom

## 快速开始

### 安装依赖

```bash
npm install
```

如果安装后原生模块不可用，可执行：

```bash
npm run rebuild
```

### 启动开发环境

```bash
npm run dev
```

### 常用检查命令

```bash
# Lint
npm run lint

# 自动修复 Lint
npm run lint:fix

# 运行测试
npm run test:run

# 覆盖率
npm run test:coverage

# 检查格式
npm run format:check
```

## 常用构建命令

```bash
# 默认 Electron 打包入口
npm run build

# 仅构建前端与主进程产物，不打包安装包
npm run web:build

# 单平台打包
npm run electron:build:mac
npm run electron:build:win
npm run electron:build:linux

# 全平台打包
npm run build:all
npm run electron:build:all
```

交互式构建脚本也可直接使用：

```bash
bash scripts/build-all.sh
bash scripts/build-all.sh --all
```

支持的常见参数：

```bash
--all
--mac
--win
--linux
--skip-assets
--dry-run
```

产物默认输出到：

```text
release/<version>/
```

## 项目结构

```text
.
├── src/                    # Renderer 代码
│   ├── components/         # 通用组件
│   ├── config/            # Feature 注册、配置等
│   ├── features/          # 业务功能模块
│   ├── hooks/             # 通用 hooks
│   ├── services/          # 渲染侧服务与类型
│   ├── shared/            # 共享类型、IPC 契约、工具
│   ├── store/             # Zustand stores 与 slices
│   └── theme/             # 主题相关
├── electron/              # 主进程、preload 与桌面能力
│   ├── ipc/               # IPC handlers
│   ├── storage/           # 本地存储模块
│   ├── sync/              # WebDAV 同步
│   ├── knowledge/         # 向量知识库
│   ├── windows/           # 窗口管理
│   └── ai/                # AI 适配器
├── tests/                 # 单元测试
├── scripts/               # 构建脚本
└── docs/                  # 补充文档
```

## 架构概览

InfinityNoteX 采用比较清晰的分层结构：

```text
Renderer UI (src/)
  -> preload bridge (electron/preload.ts)
  -> IPC handlers (electron/ipc/*.ts)
  -> main domain services (storage / sync / knowledge / ai / windows)
  -> local file system / sqlite / native capabilities
```

关键设计点：

- Renderer 不直接访问 Node.js，统一通过 preload 暴露的 `window.*` API
- IPC 契约集中在 `src/shared/types/ipc.ts`
- 工作区功能使用 `Feature Registry` 动态注册，而不是硬编码在布局层
- 状态分为 `workspaceStore` 与 `settingsStore` 两套

## 当前功能模块

### Renderer 功能模块

- `src/features/note/`：便签列表与编辑
- `src/features/ai-workbench/`：AI 工作台
- `src/features/ai-chat/`：AI 对话窗口
- `src/features/browser/`：浏览器卡片与网页看板
- `src/features/todo/`：任务清单
- `src/features/editor/`：富文本编辑器能力
- `src/features/settings/`：设置面板
- `src/features/layout/`：主布局

### 主进程核心模块

- `electron/storage/`：本地数据存储、索引、备份、迁移、健康检查
- `electron/sync/`：WebDAV 同步
- `electron/knowledge/`：语义检索与向量索引
- `electron/ai/`：AI Provider 适配
- `electron/windows/`：主窗口、悬浮窗口、AI 窗口等

## 开发时最常看的文件

- `src/App.tsx`：应用入口、窗口模式切换、初始化副作用
- `src/config/featureRegistry.tsx`：Feature 注册机制
- `src/features/registerAllFeatures.ts`：统一 Feature 注册入口
- `src/store/workspaceStore.ts`：工作区运行时状态
- `src/store/settingsStore.ts`：设置相关状态
- `src/shared/types/ipc.ts`：IPC 契约单一来源
- `electron/preload.ts`：Renderer 可调用的 bridge API
- `electron/ipc/storageHandlers.ts`：主要 CRUD IPC 暴露
- `electron/storage/StorageManager.ts`：存储总入口
- `electron/storage/core/moduleRegistry.ts`：存储模块注册中心

## 如何扩展项目

### 1. 新增一个工具型功能页

这是当前最顺手的扩展方式。

推荐步骤：

1. 在 `src/features/` 下新建模块目录
2. 创建 `ListView` 与 `EditorView`
3. 在该模块 `index.tsx` 中调用 `registerFeature(...)`
4. 在 `src/features/registerAllFeatures.ts` 中导入该模块
5. 如需状态，给 `workspaceStore` 增加 slice

### 2. 新增主进程能力

例如文件导入导出、系统对话框、新窗口行为等，通常需要同时修改：

1. `src/shared/types/ipc.ts`
2. `electron/ipc/*Handlers.ts`
3. `electron/preload.ts`
4. `src/vite-env.d.ts`

### 3. 新增持久化实体

如果新功能需要本地保存新数据，通常需要：

1. 在 `electron/storage/schemas.ts` 定义 schema
2. 在 `electron/storage/core/moduleRegistry.ts` 注册模块
3. 创建新的 Storage 类或复用 `BaseStorage`
4. 在 `StorageManager.ts` 中注入
5. 通过 IPC 暴露给 Renderer

### 4. 新增编辑器能力

富文本相关能力一般落在：

- `src/features/editor/extensions/`
- `src/features/editor/menus/`
- `src/features/editor/core/TipTapEditor.tsx`

适合这里的改动包括：

- 新节点 / mark
- Slash 命令
- Markdown / 粘贴增强
- 图片、表格、任务列表能力扩展

## 自动更新

项目已集成 `electron-updater`，并在界面中提供更新状态提示与手动检查入口。

启用自动更新时需要关注：

1. 发布渠道
   - 默认使用 GitHub Releases
   - GitHub Actions 发布默认使用 `secrets.GITHUB_TOKEN`
   - 本地手动发布可通过 `GH_TOKEN=<your-token>` 上传
   - 如需自建源，可通过 `INFINITY_UPDATER_URL=https://your-domain/path` 覆盖
2. 版本号
   - 每次发版前需要更新 `package.json` 中的 `version`
3. 签名
   - macOS / Windows 仍需配置对应签名参数
4. 调试限制
   - 开发模式下自动更新不会完整生效，需要在打包产物中验证

可配置的轮询参数：

- `INFINITY_UPDATER_INITIAL_DELAY_MS`
- `INFINITY_UPDATER_INTERVAL_MS`

## 测试

项目测试基于 Vitest：

```bash
# 全量测试
npm run test:run

# UI 模式
npm run test:ui

# 覆盖率
npm run test:coverage
```

测试位置：

- `src/**/*.{test,spec}.{ts,tsx}`
- `tests/**/*.{test,spec}.{ts,tsx}`

推荐开发习惯：

- 改 store 时至少运行相关 store / hook 测试
- 改 storage 时优先运行 `tests/unit/main/storage/*`
- 改 IPC 时至少做一次 renderer 到 main 的手工验证

## 代码风格

- TypeScript 严格模式
- 避免 `any`
- 优先使用中文注释说明复杂流程
- 组件与样式文件尽量保持同目录组织
- 状态逻辑尽量放入 store / hook / service，而不是堆在组件里

项目还使用：

- ESLint
- Prettier
- Husky
- lint-staged

## 开发说明

如果你是项目维护者或后续开发者，建议继续阅读：

- [AGENTS.md](./AGENTS.md)

`AGENTS.md` 包含更细的开发约定，包括：

- Feature 注册机制
- Zustand store 组织方式
- IPC 扩展标准路径
- Storage 模块新增方式
- 同步 / 知识库 / 编辑器扩展落点
- 常见漏改项与提交前检查清单

## 开源协作

开源协作相关文档：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [SUPPORT.md](./SUPPORT.md)

首次贡献建议先阅读 `CONTRIBUTING.md`，并在提交前完成其中的自检项。

## 常见问题

### `npm install` 后原生模块报错怎么办？

执行：

```bash
npm run rebuild
```

### 新增功能后为什么界面没有出现？

先检查：

- 是否已经在 `src/features/registerAllFeatures.ts` 注册
- 是否调用了 `registerFeature(...)`

### Renderer 调不到新 API？

先检查：

- `src/shared/types/ipc.ts`
- `electron/ipc/*Handlers.ts`
- `electron/preload.ts`
- `src/vite-env.d.ts`

## License

本项目采用 [MIT License](./LICENSE)。
