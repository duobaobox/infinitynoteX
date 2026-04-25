# Contributing to InfinityNoteX

感谢你愿意参与 InfinityNoteX。

## 开始之前

1. Fork 仓库并创建功能分支。
2. 安装依赖：npm install。
3. 启动开发：npm run dev。
4. 提交前执行：
   - npm run lint
   - npm run test:run
   - npm run format:check

## 提交规范

1. 一个 PR 聚焦一个目标（修复、功能、重构三选一）。
2. 提交信息建议使用简洁动宾结构，例如：
   - fix: 修复 AI 对话窗口关闭异常
   - feat: 新增 WebDAV 预检提示
3. 不要提交以下内容：
   - 本地私有配置（如 .env、.claude、.agent）
   - 构建产物和打包文件
   - 用户数据与日志

## 代码约定

1. Renderer 侧不要直接访问 Node.js API。
2. 新桌面能力请走 preload + IPC + handler 的完整链路。
3. IPC 方法名以 src/shared/types/ipc.ts 为单一来源。
4. 复杂状态优先落到 store slice，而不是堆在组件内。

## Pull Request 清单

1. 说明问题背景与解决思路。
2. 说明影响范围（Renderer/Main/IPC/Storage/Sync）。
3. 提供验证方式（命令、手工步骤、截图可选）。
4. 若改动配置或行为，更新 README / docs。

## 行为要求

参与本项目即代表同意遵守 CODE_OF_CONDUCT.md。
