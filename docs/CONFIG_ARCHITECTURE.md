# InfinityNoteX 配置架构重构方案

> **文档版本**：v2.0  
> **日期**：2025-12-03  
> **状态**：🔴 **开发阶段 - 可破坏性重构**  
> **目的**：统一配置管理、消除冗余、建立可扩展的插槽化架构

---

## 目录

1. [现状分析（问题诊断）](#一现状分析问题诊断)
2. [重构目标](#二重构目标)
3. [目标文件结构](#三目标文件结构)
4. [app-config.json 结构设计](#四app-configjson-结构设计)
5. [数据文件详解](#五数据文件详解)
6. [API 设计](#六api-设计)
7. [删除/优化项清单](#七删除优化项清单)
8. [重构执行计划](#八重构执行计划)
9. [依赖管理（cnpm）](#九依赖管理cnpm)
10. [插槽化扩展示例](#十插槽化扩展示例)
11. [小结](#十一小结)

---

## 一、现状分析（问题诊断）

### 1.1 当前配置/存储分布（碎片化）

| 文件/Key                                           | 位置                    | 管理方                                  | 用途                              | 状态                |
| -------------------------------------------------- | ----------------------- | --------------------------------------- | --------------------------------- | ------------------- |
| \`ai-config.json\`                                 | \`<userData>/\`         | 主进程 \`electron/ai.ts\`               | AI 活动配置（provider、model 等） | ❌ 独立文件         |
| \`sync-config.json\`                               | \`<userData>/\`         | 主进程 \`electron/sync/syncManager.ts\` | WebDAV 同步配置                   | ❌ 独立文件         |
| \`window-state.json\`                              | \`<userData>/\`         | 主进程 \`electron/main.ts\`             | 窗口大小/位置                     | ❌ 独立文件         |
| \`localStorage:theme.\*\`                          | 渲染进程                | \`src/theme/theme.ts\`                  | 主题色/模式/背景                  | ⚠️ 无法跨设备同步   |
| \`localStorage:infinitynotex:ai:provider-configs\` | 渲染进程                | \`src/services/aiConfigStore.ts\`       | AI 多 provider 缓存               | ❌ 与主进程数据重复 |
| \`data-v1/\` 目录                                  | \`<userData>/data-v1/\` | 主进程 \`StorageManager\`               | 业务数据                          | ✅ 结构清晰，保留   |

### 1.2 当前代码文件问题

| 文件                              | 问题                                     | 建议                                     |
| --------------------------------- | ---------------------------------------- | ---------------------------------------- |
| \`electron/ai.ts\`                | 混合了配置管理 + OpenAI 适配器，职责不清 | 拆分为 \`config.ts\` + \`ai/adapter.ts\` |
| \`electron/storage.ts\`           | 仅重导出 \`./storage/index\`，无实际逻辑 | 🗑️ 删除                                  |
| \`electron/main.ts\`              | 窗口状态读写逻辑内联（80+ 行）           | 移到 \`config.ts\`                       |
| \`src/services/aiConfigStore.ts\` | localStorage 存储与主进程重复            | 🗑️ 删除                                  |
| \`src/theme/theme.ts\`            | localStorage 存储，无法跨设备            | 改用 IPC                                 |

### 1.3 核心问题总结

| #   | 问题               | 影响                                                               |
| --- | ------------------ | ------------------------------------------------------------------ |
| 1   | **配置碎片化**     | 4 个独立 JSON 文件 + 多个 localStorage key，无统一入口             |
| 2   | **数据不一致**     | AI provider configs 在 localStorage 和主进程各存一份，易出现不同步 |
| 3   | **存储路径不持久** | \`StorageContext\` 只有内存状态，用户选择的路径重启后丢失          |
| 4   | **不可扩展**       | 新增功能需手动加文件/加 localStorage key，无插槽机制               |
| 5   | **冗余代码**       | \`electron/storage.ts\` 只是重导出，增加维护成本                   |

---

## 二、重构目标

| #   | 目标             | 描述                                                                 |
| --- | ---------------- | -------------------------------------------------------------------- |
| 1   | **单一配置入口** | 所有应用级设置统一到 \`<userData>/app-config.json\`                  |
| 2   | **消除重复**     | 删除 \`ai-config.json\`、\`sync-config.json\`、\`window-state.json\` |
| 3   | **主进程主权**   | 配置读写只在主进程，渲染进程通过 IPC 操作                            |
| 4   | **插槽化架构**   | namespace 分区，后续功能可无侵入扩展                                 |
| 5   | **精简代码**     | 删除冗余文件，合并相似逻辑                                           |

---

## 三、目标文件结构

### 3.1 主进程目录 \`electron/\`

\`\`\`
electron/
├── config.ts # 【新增】统一配置管理（读/写/迁移）
├── main.ts # 应用入口（集成 config 初始化）
├── preload.ts # IPC 桥接（暴露 window.app API）
├── updater.ts # 自动更新（保留）
├── electron-env.d.ts # 类型定义（保留）
│
├── ai/ # 【重构】AI 相关（从 ai.ts 拆分）
│ ├── index.ts # 导出
│ └── adapter.ts # OpenAI 兼容适配器
│
├── sync/ # 同步模块（保留，配置读写改为从 config.ts 获取）
│ ├── index.ts # 【新增】统一导出
│ ├── syncEngine.ts # 三方比对引擎
│ ├── syncManager.ts # 【修改】不再自己管 sync-config.json
│ ├── syncUtils.ts # 工具函数
│ ├── webdavClient.ts # WebDAV 客户端
│ └── types.ts # 类型定义
│
└── storage/ # 业务数据存储（保留）
├── index.ts # 统一导出
├── StorageContext.ts # 【修改】初始化时从 config 读取 dataPath
├── StorageManager.ts # 存储管理器
├── FolderStorage.ts # 文件夹操作
├── NoteStorage.ts # 笔记操作
├── AIStorage.ts # AI 对话操作
├── types.ts # 类型定义
├── errors.ts # 错误定义
├── utils.ts # 工具函数
├── migrations.ts # 数据迁移
└── schemas.ts # 数据校验
\`\`\`

### 3.2 渲染进程 \`src/\`（需修改部分）

\`\`\`
src/
├── services/
│ ├── aiConfig.ts # AI 类型定义（保留）
│ └── aiConfigStore.ts # 【删除】不再用 localStorage
│
├── theme/
│ └── theme.ts # 【修改】改为通过 IPC 读写
│
└── store/
└── settingsStore.ts # 【修改】统一使用 window.app.setConfig
\`\`\`

### 3.3 用户数据目录 \`<userData>/\`

#### 重构前（碎片化）

\`\`\`
<userData>/
├── ai-config.json # ❌ 待删除
├── sync-config.json # ❌ 待删除
├── window-state.json # ❌ 待删除
└── data-v1/ # ✅ 保留
├── meta.json
├── folders.json
├── notes.index.json
├── notes/
├── ai-conversations.index.json
├── ai-conversations/
├── sync-state.json
├── temp/
└── backups/
\`\`\`

#### 重构后（统一）

\`\`\`
<userData>/
├── app-config.json # ✅ 统一配置（新增）
└── data-v1/ # ✅ 业务数据（或用户自定义路径）
├── meta.json
├── folders.json
├── notes.index.json
├── notes/
│ └── <noteId>.json
├── ai-conversations.index.json
├── ai-conversations/
│ └── <conversationId>.json
├── sync-state.json
├── temp/
└── backups/
\`\`\`

---

## 四、app-config.json 结构设计

### 4.1 完整结构

\`\`\`jsonc
{
"schemaVersion": 1,

// ========== 存储配置 ==========
"storage": {
"dataPath": null // null = 使用默认路径 <userData>/data-v1
// 非空 = 用户自定义路径
},

// ========== 窗口状态 ==========
"window": {
"width": 1200,
"height": 800,
"x": null, // null = 居中
"y": null,
"isMaximized": false
},

// ========== 主题配置 ==========
"theme": {
"colorPrimary": "#1677ff",
"mode": "auto", // "light" | "dark" | "auto"
"bgLight": "linear-gradient(135deg, #e6f2ff 0%, #f0e6ff 100%)",
"bgDark": "linear-gradient(165deg, #111827 0%, #0b1220 100%)"
},

// ========== AI 配置 ==========
"ai": {
"activeProviderId": "deepseek",
"providers": {
"deepseek": {
"provider": "deepseek",
"baseURL": "https://api.deepseek.com/v1",
"apiKey": "sk-xxx",
"model": "deepseek-chat",
"temperature": 0.7,
"maxTokens": 4096
},
"openai": {
"provider": "openai",
"baseURL": "https://api.openai.com/v1",
"apiKey": "",
"model": "gpt-4o",
"temperature": 0.7
},
"ollama": {
"provider": "ollama",
"baseURL": "http://localhost:11434",
"apiKey": "",
"model": "llama3"
}
}
},

// ========== 同步配置 ==========
"sync": {
"enabled": false,
"activeProvider": "webdav",
"providers": {
"webdav": {
"url": "",
"username": "",
"password": "", // 敏感信息，主进程持有
"remotePath": "/InfinityNoteX",
"conflictStrategy": "newest"
}
}
},

// ========== 功能插槽（预留） ==========
"features": {
// 示例：
// "reminder": { "enabled": true, "defaultTime": "09:00" },
// "export": { "defaultFormat": "markdown" }
},

// ========== 插件插槽（预留） ==========
"plugins": {
// 示例：
// "my-plugin-id": { "enabled": true, "setting1": "value" }
}
}
\`\`\`

### 4.2 各字段详解

| 字段路径                | 类型             | 默认值       | 作用                 | 读取时机              | 写入时机       |
| ----------------------- | ---------------- | ------------ | -------------------- | --------------------- | -------------- |
| \`schemaVersion\`       | \`number\`       | \`1\`        | 配置版本号，用于迁移 | 应用启动              | 迁移后         |
| \`storage.dataPath\`    | \`string\|null\` | \`null\`     | 用户自定义数据目录   | 初始化 StorageContext | 设置页更改路径 |
| \`window.width\`        | \`number\`       | \`1200\`     | 窗口宽度             | 创建窗口              | 窗口关闭       |
| \`window.height\`       | \`number\`       | \`800\`      | 窗口高度             | 创建窗口              | 窗口关闭       |
| \`window.x\`            | \`number\|null\` | \`null\`     | 窗口 X 坐标          | 创建窗口              | 窗口关闭       |
| \`window.y\`            | \`number\|null\` | \`null\`     | 窗口 Y 坐标          | 创建窗口              | 窗口关闭       |
| \`window.isMaximized\`  | \`boolean\`      | \`false\`    | 是否最大化           | 创建窗口              | 窗口关闭       |
| \`theme.colorPrimary\`  | \`string\`       | \`#1677ff\`  | 主题主色             | 应用启动 + 设置加载   | 设置页更改     |
| \`theme.mode\`          | \`string\`       | \`auto\`     | 主题模式             | 应用启动              | 设置页更改     |
| \`theme.bgLight\`       | \`string\`       | (渐变)       | 亮色背景             | 应用启动              | 设置页更改     |
| \`theme.bgDark\`        | \`string\`       | (渐变)       | 暗色背景             | 应用启动              | 设置页更改     |
| \`ai.activeProviderId\` | \`string\`       | \`deepseek\` | 当前 AI 供应商       | AI 聊天               | 切换供应商     |
| \`ai.providers.\*\`     | \`object\`       | (见上)       | AI 供应商配置        | AI 聊天               | 设置页保存     |
| \`sync.enabled\`        | \`boolean\`      | \`false\`    | 是否启用同步         | 启动/手动同步         | 设置页         |
| \`sync.activeProvider\` | \`string\`       | \`webdav\`   | 当前同步供应商       | 执行同步              | 设置页         |
| \`sync.providers.\*\`   | \`object\`       | (见上)       | 同步供应商配置       | 执行同步              | 设置页保存     |
| \`features.\*\`         | \`object\`       | \`{}\`       | 功能插槽             | 功能模块初始化        | 功能设置保存   |
| \`plugins.\*\`          | \`object\`       | \`{}\`       | 插件配置             | 插件加载              | 插件设置保存   |

---

## 五、数据文件详解

### 5.1 应用配置文件

| 文件                | 路径            | 格式 | 作用                             | 同步范围              |
| ------------------- | --------------- | ---- | -------------------------------- | --------------------- |
| \`app-config.json\` | \`<userData>/\` | JSON | 应用设置（主题、AI、同步、窗口） | ❌ 不同步（设备相关） |

### 5.2 业务数据文件（\`data-v1/\`）

| 文件                            | 路径                          | 格式 | 作用                                        | 同步范围  |
| ------------------------------- | ----------------------------- | ---- | ------------------------------------------- | --------- |
| \`meta.json\`                   | \`data-v1/\`                  | JSON | 数据库元信息（版本、创建时间）              | ❌ 不同步 |
| \`folders.json\`                | \`data-v1/\`                  | JSON | 文件夹树结构                                | ✅ 同步   |
| \`notes.index.json\`            | \`data-v1/\`                  | JSON | 笔记索引（id → 标题、所属文件夹、时间戳）   | ✅ 同步   |
| \`notes/<id>.json\`             | \`data-v1/notes/\`            | JSON | 单个笔记内容                                | ✅ 同步   |
| \`ai-conversations.index.json\` | \`data-v1/\`                  | JSON | AI 对话索引                                 | ❌ 不同步 |
| \`ai-conversations/<id>.json\`  | \`data-v1/ai-conversations/\` | JSON | 单个 AI 对话内容                            | ❌ 不同步 |
| \`sync-state.json\`             | \`data-v1/\`                  | JSON | 本地同步状态（上次同步时间、manifest hash） | ❌ 不同步 |
| \`temp/\`                       | \`data-v1/temp/\`             | 目录 | 临时文件                                    | ❌ 不同步 |
| \`backups/\`                    | \`data-v1/backups/\`          | 目录 | 备份文件                                    | ❌ 不同步 |

### 5.3 WebDAV 远程文件

| 文件                 | 路径                    | 作用                            |
| -------------------- | ----------------------- | ------------------------------- |
| \`manifest.json\`    | \`<remotePath>/\`       | 远程文件清单（文件列表 + hash） |
| \`folders.json\`     | \`<remotePath>/\`       | 文件夹结构（同步）              |
| \`notes.index.json\` | \`<remotePath>/\`       | 笔记索引（同步）                |
| \`notes/<id>.json\`  | \`<remotePath>/notes/\` | 笔记内容（同步）                |

---

## 六、API 设计

### 6.1 主进程 \`electron/config.ts\`

\`\`\`typescript
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// 类型定义
export interface AppConfig {
schemaVersion: number;
storage: { dataPath: string | null };
window: { width: number; height: number; x?: number; y?: number; isMaximized: boolean };
theme: { colorPrimary: string; mode: 'light' | 'dark' | 'auto'; bgLight: string; bgDark: string };
ai: { activeProviderId: string; providers: Record<string, AIProviderConfig> };
sync: { enabled: boolean; activeProvider: string; providers: Record<string, SyncProviderConfig> };
features: Record<string, unknown>;
plugins: Record<string, unknown>;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// 核心 API
export function getConfigPath(): string {
return path.join(app.getPath('userData'), 'app-config.json');
}

export function getDefaultConfig(): AppConfig {
return { /_ 默认值 _/ };
}

export function readAppConfig(): AppConfig {
const configPath = getConfigPath();
if (!fs.existsSync(configPath)) {
return getDefaultConfig();
}
const raw = fs.readFileSync(configPath, 'utf-8');
const config = JSON.parse(raw);
return migrateConfig(config);
}

export function writeAppConfig(partial: DeepPartial<AppConfig>): void {
const current = readAppConfig();
const merged = deepMerge(current, partial);
fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2));
}

export function migrateConfig(config: AppConfig): AppConfig {
// 版本迁移逻辑
return config;
}
\`\`\`

### 6.2 IPC Handlers（\`electron/main.ts\`）

\`\`\`typescript
import { ipcMain, BrowserWindow } from 'electron';
import { readAppConfig, writeAppConfig, getConfigPath } from './config';

// 获取配置
ipcMain.handle('app:getConfig', () => readAppConfig());

// 更新配置（深度合并 + 广播）
ipcMain.handle('app:setConfig', (\_, partial) => {
writeAppConfig(partial);
const newConfig = readAppConfig();
BrowserWindow.getAllWindows().forEach(w =>
w.webContents.send('app:configChanged', newConfig)
);
return newConfig;
});

// 获取配置文件路径
ipcMain.handle('app:getConfigPath', () => getConfigPath());
\`\`\`

### 6.3 Preload 暴露（\`electron/preload.ts\`）

\`\`\`typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('app', {
getConfig: () => ipcRenderer.invoke('app:getConfig'),
setConfig: (partial: unknown) => ipcRenderer.invoke('app:setConfig', partial),
getConfigPath: () => ipcRenderer.invoke('app:getConfigPath'),
onConfigChanged: (callback: (config: unknown) => void) => {
const listener = (\_: unknown, config: unknown) => callback(config);
ipcRenderer.on('app:configChanged', listener);
return () => ipcRenderer.removeListener('app:configChanged', listener);
}
});
\`\`\`

### 6.4 渲染进程使用

\`\`\`typescript
// 读取配置
const config = await window.app.getConfig();
console.log(config.theme.colorPrimary);

// 更新配置（深度合并）
await window.app.setConfig({
theme: { colorPrimary: '#ff5722' }
});

// 监听配置变化
const unsubscribe = window.app.onConfigChanged((newConfig) => {
applyTheme(newConfig.theme);
});

// 组件卸载时取消监听
onCleanup(() => unsubscribe());
\`\`\`

---

## 七、删除/优化项清单

### 7.1 待删除文件

| 文件                              | 原因                      | 替代方案                                 |
| --------------------------------- | ------------------------- | ---------------------------------------- |
| \`electron/storage.ts\`           | 仅重导出，无实际逻辑      | 直接 import \`./storage/index\`          |
| \`electron/ai.ts\`                | 配置 + 适配器混合         | 拆分为 \`config.ts\` + \`ai/adapter.ts\` |
| \`src/services/aiConfigStore.ts\` | localStorage 与主进程重复 | 使用 \`window.app.getConfig().ai\`       |

### 7.2 待删除配置文件

| 文件                             | 替代                              |
| -------------------------------- | --------------------------------- |
| \`<userData>/ai-config.json\`    | 合并到 \`app-config.json.ai\`     |
| \`<userData>/sync-config.json\`  | 合并到 \`app-config.json.sync\`   |
| \`<userData>/window-state.json\` | 合并到 \`app-config.json.window\` |

### 7.3 待删除 localStorage keys

| Key                                   | 替代                                   |
| ------------------------------------- | -------------------------------------- |
| \`theme.colorPrimary\`                | \`app-config.json.theme.colorPrimary\` |
| \`theme.mode\`                        | \`app-config.json.theme.mode\`         |
| \`theme.bgLight\`                     | \`app-config.json.theme.bgLight\`      |
| \`theme.bgDark\`                      | \`app-config.json.theme.bgDark\`       |
| \`infinitynotex:ai:provider-configs\` | \`app-config.json.ai.providers\`       |

### 7.4 需修改文件

| 文件                                   | 修改内容                                           |
| -------------------------------------- | -------------------------------------------------- |
| \`electron/main.ts\`                   | 移除窗口状态读写逻辑，改用 \`config.ts\`           |
| \`electron/sync/syncManager.ts\`       | 移除 \`sync-config.json\` 读写，改用 \`config.ts\` |
| \`electron/storage/StorageContext.ts\` | 启动时从 \`config.storage.dataPath\` 读取路径      |
| \`electron/preload.ts\`                | 新增 \`window.app\` API                            |
| \`src/theme/theme.ts\`                 | 改用 IPC 读写配置                                  |
| \`src/store/settingsStore.ts\`         | 统一使用 \`window.app.setConfig\`                  |
| \`src/vite-env.d.ts\`                  | 添加 \`window.app\` 类型声明                       |

---

## 八、重构执行计划

### 阶段 1：创建统一配置模块 ⏱️ 预计 2h

- [ ] 新建 \`electron/config.ts\`
  - 实现 \`getConfigPath()\`
  - 实现 \`getDefaultConfig()\`
  - 实现 \`readAppConfig()\`
  - 实现 \`writeAppConfig()\`
  - 实现 \`migrateConfig()\`
  - 实现 \`deepMerge()\` 工具函数
- [ ] 在 \`electron/main.ts\` 注册 IPC handlers
  - \`app:getConfig\`
  - \`app:setConfig\`
  - \`app:getConfigPath\`
- [ ] 在 \`electron/preload.ts\` 暴露 \`window.app\` API
- [ ] 更新 \`src/vite-env.d.ts\` 类型声明

### 阶段 2：迁移现有配置 ⏱️ 预计 3h

- [ ] 拆分 \`electron/ai.ts\`
  - 新建 \`electron/ai/adapter.ts\`（OpenAI 兼容适配器）
  - 新建 \`electron/ai/index.ts\`（导出）
  - AI 配置读写改用 \`config.ts\`
  - 删除 \`electron/ai.ts\`
- [ ] 修改 \`electron/sync/syncManager.ts\`
  - 配置读写改用 \`config.ts\`
  - 删除 \`sync-config.json\` 相关代码
- [x] 修改 \`electron/main.ts\`
  - 窗口状态读写改用 \`config.ts\`
  - 删除 \`window-state.json\` 相关代码
- [x] 删除 \`electron/storage.ts\`

### 阶段 3：前端适配 ✅ 已完成

- [x] 修改 \`src/theme/theme.ts\`
  - 初始化时从 \`window.app.getConfig().theme\` 读取
  - 更新时调用 \`window.app.setConfig({ theme: {...} })\`
  - 删除 localStorage 相关代码
- [x] 重写 \`src/services/aiConfigStore.ts\`（未删除，改为使用 window.app API）
  - 使用内存缓存 + IPC 异步写入
  - 保留事件系统用于组件间通信
- [x] 修改 \`src/store/settingsStore.ts\`
  - 初始化时调用 \`initializeAIConfigCache()\`
  - 配置通过 \`window.app.setConfig()\` 持久化
- [x] 修改 \`src/components/AIChat/hooks/useAIConfig.ts\`
  - 初始化时调用 \`initializeAIConfigCache()\`

### 阶段 4：清理与测试 ✅ 已完成

- [x] 运行 TypeScript 检查 \`npx tsc --noEmit\`
- [x] 运行应用测试基本功能
  - 配置迁移成功（ai-config.json → app-config.json）
  - 应用启动正常
- [ ] 手动测试其他功能
  - 窗口状态保存/恢复
  - 主题切换
  - AI 配置保存/读取
  - WebDAV 同步配置
- [x] 更新 README 说明依赖安装使用 \`cnpm\`

---

## 九、依赖管理（cnpm）

项目统一使用 \`cnpm\` 安装依赖（国内镜像加速）：

\`\`\`bash

# 安装 cnpm（如未安装）

npm install -g cnpm --registry=https://registry.npmmirror.com

# 安装项目依赖

cnpm install

# 开发启动（仍用 npm run）

npm run dev

# 构建打包

npm run build
\`\`\`

> ⚠️ 注意：只有 \`install\` 使用 \`cnpm\`，其他命令（\`run dev\`、\`run build\`）仍用 \`npm\`。

### CI/CD 配置

\`\`\`yaml

# GitHub Actions 示例

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
  node-version: '20'
- name: Install cnpm
  run: npm install -g cnpm --registry=https://registry.npmmirror.com
- name: Install dependencies
  run: cnpm install
- name: Build
  run: npm run build
  \`\`\`

---

## 十、插槽化扩展示例

### 10.1 添加新功能（如：提醒功能）

1. **定义配置结构**：

\`\`\`jsonc
// app-config.json
{
"features": {
"reminder": {
"enabled": true,
"defaultTime": "09:00",
"sound": true
}
}
}
\`\`\`

2. **功能模块读取配置**：

\`\`\`typescript
// src/features/reminder/useReminderConfig.ts
export function useReminderConfig() {
const [config, setConfig] = useState(null);

useEffect(() => {
window.app.getConfig().then(cfg => {
setConfig(cfg.features?.reminder ?? { enabled: false });
});

    const unsub = window.app.onConfigChanged(cfg => {
      setConfig(cfg.features?.reminder ?? { enabled: false });
    });

    return unsub;

}, []);

const updateConfig = async (partial) => {
await window.app.setConfig({
features: { reminder: { ...config, ...partial } }
});
};

return { config, updateConfig };
}
\`\`\`

3. **无需修改核心代码**：功能模块自包含配置读写

### 10.2 添加插件

1. 插件注册配置到 \`plugins.<pluginId>\`
2. 插件可以读写自己 namespace 下的任意配置
3. 卸载插件时清理对应 namespace

\`\`\`typescript
// 插件初始化
await window.app.setConfig({
plugins: {
'my-plugin': {
enabled: true,
apiEndpoint: 'https://...'
}
}
});

// 插件读取配置
const cfg = await window.app.getConfig();
const myConfig = cfg.plugins['my-plugin'];

// 插件卸载清理
await window.app.setConfig({
plugins: {
'my-plugin': undefined // 删除
}
});
\`\`\`

---

## 十一、小结

### 重构前后对比

| 项目             | 重构前                             | 重构后                        |
| ---------------- | ---------------------------------- | ----------------------------- |
| 配置文件数量     | 4 个 JSON + 5 个 localStorage keys | 1 个 \`app-config.json\`      |
| 配置管理代码     | 分散在 5+ 个文件                   | 统一在 \`electron/config.ts\` |
| 渲染进程配置访问 | 混用 localStorage + 多个 IPC       | 统一通过 \`window.app\` API   |
| 数据一致性       | AI 配置在两处各存一份              | 单一数据源                    |
| 扩展性           | 手动加文件/加 key                  | namespace 插槽化              |
| 代码行数         | 约 300+ 行配置相关代码             | 约 150 行                     |

### 关键收益

1. **可维护性**：配置逻辑集中，易于理解和修改
2. **一致性**：消除渲染/主进程数据不同步问题
3. **扩展性**：新功能/插件无需改动核心代码
4. **升级体验**：版本迁移机制保证用户数据平滑升级

---

## 下一步

确认此方案后，可按照 **阶段 1 → 阶段 4** 顺序执行重构。

如需开始实施，请确认。
