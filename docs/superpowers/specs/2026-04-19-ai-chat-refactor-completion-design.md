# AI Chat 重构收尾设计

> 基于 `.agent/docs/REFACTORING.md` 的 “AI Chat 完整改造执行计划”，目标是把当前半完成状态彻底收口，不保留双轨主路径。

## 1. 目标

本次收尾的目标不是继续“补几处兼容逻辑”，而是完成 AI Chat 主路径的硬切换：

- 让 `store + ChatOrchestrator` 成为唯一的请求生命周期与工具审批真相来源
- 让 `useAIChat` 退化为薄适配层，而不是再维护一套 ref 驱动状态机
- 修复 `approvalId` / `toolCallId` 契约混用问题
- 统一消息格式、历史读写与 IPC 事件定义，避免重复转换和字符串漂移
- 删除旧主逻辑与失效兼容层，避免未来继续在两套架构上叠补丁

## 2. 非目标

本次不做以下事项：

- 不替换 `@ant-design/x-sdk`
- 不重写 AI provider / model adapter / tool registry 主进程实现
- 不新增新的聊天产品能力
- 不改造与 AI Chat 无关的 note、todo、browser card 等 store 结构

## 3. 当前问题总结

当前仓库已经引入了 `RequestSlice`、`ToolCallSlice`、`ChatOrchestrator` 和主进程审批状态推送，但还处于“新骨架 + 旧主路径并存”的过渡态，主要问题如下：

1. `AIChatPanel`、`CanvasTab` 仍然通过 `useAIChat` 走旧主流程。
2. `useAIChat` 里仍保留 `requestApprovalsRef`、`requestToolDraftsRef`、`requestRunTracesRef` 等 ref 真相源。
3. 历史加载、外部刷新、保存逻辑仍然分散在 hook 内多个 effect / callback 中。
4. `ChatOrchestrator` 还未接入真实 UI 主路径，测试覆盖的是自造契约，不是实际运行契约。
5. `ToolCall` 未保存 `approvalId`，导致 renderer 容易把 `toolCallId` 错当审批 ID 传回 main。
6. `ai:approval-state-changed` 尚未纳入共享 IPC 常量单一来源。
7. 消息模型仍然存在 `Message`、`ChatItem`、`AIMessageData`、`XChatMessage` 多套并存，边界不清。

## 4. 设计原则

### 4.1 单一真理来源

- 请求生命周期只由 `RequestSlice` 维护
- 工具调用生命周期只由 `ToolCallSlice` 维护
- 对话消息只由 `AIConversationSlice` 维护
- UI 只消费 store 派生数据，不直接持有并维护独立业务状态

### 4.2 适配层最薄化

- `useAIChat` 只负责对组件暴露稳定 API
- `ChatOrchestrator` 负责请求编排、IPC 事件订阅、状态迁移、持久化时机控制
- `IpcChatProvider` 只保留 x-sdk 所需 transport 适配，不再承担业务状态真相职责

### 4.3 共享契约收口

- IPC 事件名必须进入共享常量定义
- `window.ai` 的类型声明必须与 preload 暴露保持一致
- `approvalId` 与 `toolCallId` 的语义必须在类型上区分，不能靠约定记忆

### 4.4 一次请求一次落盘

- 历史持久化由 orchestrator 统一控制
- 历史恢复使用单一 converter
- 不允许在审批更新、流结束、外部刷新等多个位置重复拼装并落盘同一份数据

## 5. 目标架构

```text
AIChatPanel / CanvasTab / other consumers
  ↓
useAIChat (thin facade)
  ↓
ChatOrchestrator
  ├─ dispatch request / tool / message actions to workspace store
  ├─ subscribe to window.ai stream / tool / approval events
  ├─ convert persistence format <-> store message format
  └─ control save / load / clear timing
  ↓
workspace store
  ├─ AIConversationSlice
  ├─ RequestSlice
  ├─ ToolCallSlice
  └─ RetrievalSlice
  ↓
preload / IPC / main process
```

核心变化是：组件与 hook 不再各自拼接工具审批、tool draft、run trace 和历史持久化逻辑，所有这些都统一下沉到 orchestrator + store。

## 6. 数据模型设计

### 6.1 核心内部消息格式

内部统一以 `AIConversationSlice.Message` 作为业务真相模型，职责如下：

- `id`, `role`, `content`, `timestamp`：基础消息信息
- `reasoning`：持久化层使用的思考内容
- `references`, `ragSources`, `relatedToolCallIds`：业务关联数据
- `toolApprovals`, `runTrace`：与消息绑定的 UI/运行态展示数据

约束：

- store 中的 `content` 保持“用户可见正文”语义
- `<think>...</think>` 仅作为 x-sdk / Markdown 展示层需要时的转换表示，不作为 store 真相
- 持久化时使用 `reasoning + content` 分字段保存，不在 store 内长期保存标签化内容

### 6.2 派生模型

- `ChatItem`: 仅作为 UI 渲染模型，由 store message + tool call 状态派生
- `XChatMessage`: 仅作为 x-sdk provider 交互模型，不能再承载审批/历史真相
- `AIMessageData`: 仅作为存储载荷，不再在运行时成为独立真相类型

### 6.3 ToolCall 模型

`ToolCall` 必须新增并保留以下字段：

- `approvalId?: string`
- `requestId`
- `toolName`
- `state`
- `createdAt`

语义要求：

- `toolCallId` 标识一次工具调用
- `approvalId` 标识一次用户审批请求
- `approvalId` 可以为空直到 main 发回审批请求
- renderer 回复审批时必须使用 `approvalId`

## 7. 状态机设计

### 7.1 Request 状态机

沿用规划中的状态机，并要求所有状态迁移只经 slice action 发生：

- `GENERATING`
- `WAITING_APPROVALS`
- `EXECUTING_TOOLS`
- `COMPLETED`
- `ERROR`

补充约束：

- `createRequest` 创建后立即进入 `GENERATING`
- 只要存在未决审批，request 保持 `WAITING_APPROVALS`
- 只要审批通过并进入执行，request 进入 `EXECUTING_TOOLS`
- 所有流结束且无待处理工具时才允许 `COMPLETED`
- 错误必须写入 `Request.error`

### 7.2 ToolCall 状态机

- `DRAFTING`
- `PENDING_APPROVAL`
- `EXECUTING`
- `SUCCESS`
- `ERROR`
- `REJECTED`

补充约束：

- `completeToolCallDraft` 时同时记录 `approvalId`
- `approveToolCall` 仅代表 renderer 已收到 main 的执行确认，不能抢跑篡改 main 状态
- `SUCCESS` / `ERROR` / `REJECTED` 都是终态

## 8. 运行流程设计

### 8.1 发送消息

1. 组件调用 `useAIChat.sendMessage`
2. `useAIChat` 调用 orchestrator 的发送入口
3. orchestrator 创建 request
4. orchestrator 创建用户消息并写入 `AIConversationSlice`
5. orchestrator 组装历史、引用、检索上下文，发起 `window.ai.chatStream`
6. orchestrator 订阅并处理同 request 的流式事件

### 8.2 流式响应

1. 收到 `onStreamChunk`
2. 若 assistant 消息不存在则创建
3. 若存在则追加正文或 reasoning
4. 仅更新 store message，不在 hook 内再维护镜像 ref

### 8.3 工具调用草稿

1. 收到 `onToolProgress start`
2. 创建 `ToolCall`，状态为 `DRAFTING`
3. 收到 `onToolProgress delta`
4. 追加草稿输入
5. 派生 UI 时把对应 draft 显示到消息链路中

### 8.4 审批请求

1. 收到 `onToolApprovalRequest`
2. 将对应 `ToolCall` 从 `DRAFTING` 转为 `PENDING_APPROVAL`
3. 把 `approvalId` 写入 `ToolCall`
4. request 转为 `WAITING_APPROVALS`
5. 更新消息展示中的审批信息

### 8.5 审批回应

1. 组件调用 `respondToToolApproval(approvalId, approved)`
2. orchestrator 校验该 `approvalId` 存在于当前 conversation 的某个 `ToolCall`
3. 调用 `window.ai.respondToolApproval({ approvalId, approved })`
4. 依赖 `onApprovalStateChanged` 与 `respondToolApproval` 返回值共同更新工具状态和消息展示

设计要求：

- renderer 不再假设 `approvalId === toolCallId`
- follow-up approvals 必须作为新审批继续写回 `ToolCallSlice` / 消息展示

### 8.6 结束与持久化

一次 request 的保存只由 orchestrator 触发，触发点限定为：

- 正常流结束且状态可完成
- 审批链路更新完成且需要刷新对话持久化展示
- 用户清空对话

外部刷新仍可保留，但只允许“重新从存储读取并覆盖 conversation message cache”，不能再触发另一套业务拼装逻辑。

## 9. IPC 与 preload 设计

### 9.1 统一事件常量

新增并统一使用：

- `IPC_CHANNELS.aiApprovalStateChanged = 'ai:approval-state-changed'`

禁止：

- 在 preload / main / renderer 中散落硬编码相同字符串

### 9.2 preload 暴露

`window.ai` 必须统一暴露以下订阅接口：

- `onStreamChunk`
- `onStreamDone`
- `onStreamError`
- `onToolProgress`
- `onToolApprovalRequest`
- `onRunUpdate`
- `onApprovalStateChanged`

类型声明必须同步更新到：

- `src/vite-env.d.ts`
- `src/types/electron.d.ts`

### 9.3 窗口注册策略

审批状态广播不能只服务于独立 AI chat window。

要求：

- 主窗口中的 AI Chat 面板也必须能收到审批状态变化
- 如果当前主窗口已经天然通过 IPC 监听到事件，则不新增多余通道
- 如果 `ToolApprovalStateManager` 需要显式注册窗口，则主窗口与独立 AI 窗口都必须注册

## 10. 模块职责拆分

### 10.1 `useAIChat`

保留职责：

- 解析 `conversationId` / `conversationBinding`
- 提供 UI 所需状态和回调
- 订阅 store selector，输出 `chatItems`

移除职责：

- 不再保存 request 级 ref 状态
- 不再直接实现审批合并逻辑
- 不再直接处理历史持久化和多处恢复逻辑

### 10.2 `ChatOrchestrator`

负责：

- request 创建与结束
- 消息写入/更新
- 工具调用与审批状态迁移
- 历史加载、保存、清空
- IPC 事件订阅和清理
- conversation binding 解析后的主流程协同

### 10.3 converters / selectors

新增或收口为单一职责模块：

- `message persistence converter`: store message <-> storage payload
- `chat item selector/converter`: store state -> UI `ChatItem[]`

要求：

- 不在 hook 内重复手写 `<think>` 处理
- 不在多个 effect 内重复 map 历史消息

## 11. 清理策略

以下旧逻辑在新主路径切通后必须删除，不保留“以后再清”：

- `useAIChat` 中 request ref 真相源
- `useAIChat` 中重复历史加载/刷新拼装逻辑
- 不再使用的消息转换函数或临时桥接结构
- `ChatOrchestrator` 中仅用于测试桩的错误契约假设

保留兼容层的唯一条件是：

- 仍被真实调用路径使用
- 且删除会阻断本次 cut-over

否则一律删掉。

## 12. 错误处理

必须覆盖以下错误场景：

- conversation binding 解析失败
- conversation 已被删除或不存在
- `approvalId` 找不到对应 `ToolCall`
- main 返回审批失败或审批已过期
- tool execution error
- stream abort / stream error
- 历史保存失败

要求：

- request 错误写入 slice
- UI 继续能展示已产生消息与失败状态
- 不允许 silent failure

## 13. 测试策略

本次必须按回归风险补测试，重点不是数量，而是能卡住未来回退。

### 13.1 Store 单测

- `RequestSlice` 状态迁移
- `ToolCallSlice` 保存 `approvalId` 与状态机迁移

### 13.2 Orchestrator 集成测试

必须覆盖：

- 发送消息 -> 创建 request -> 创建 user message
- 流式 chunk -> assistant message 更新
- tool progress -> drafting
- approval request -> `approvalId` 写入 tool call
- `approvalId !== toolCallId` 情况下审批仍能成功
- approval state changed -> tool/request 状态正确迁移
- follow-up approvals 正确挂接
- 单次 request 只走统一保存路径

### 13.3 Hook / UI 集成测试

至少覆盖：

- `useAIChat` 通过 store/orchestrator 产出 `chatItems`
- 清空对话、加载历史、conversation 切换不再依赖旧 ref 逻辑

### 13.4 契约测试

- IPC 常量、preload 暴露、window 类型声明保持一致

## 14. 验收标准

满足以下条件才算本次收尾完成：

1. 真实 UI 主路径已切到 orchestrator + store。
2. `useAIChat` 中不再存在 request 级 ref 真相源。
3. `approvalId` / `toolCallId` 契约明确分离并通过测试保护。
4. `ai:approval-state-changed` 已纳入 IPC 单一来源。
5. 历史恢复与持久化只剩一条实现路径。
6. 旧双轨逻辑已删除，不再同时维护两套主状态机。
7. AI Chat 相关测试通过，至少覆盖上述关键场景。

## 15. 实施顺序建议

建议按以下顺序实现，避免中途反复返工：

1. 先补失败测试，锁定真实契约缺口，尤其是 `approvalId !== toolCallId`
2. 修 `ToolCall` / IPC / 类型定义，使契约可表达
3. 收口 persistence converter 与 chat item 派生路径
4. 改造 `ChatOrchestrator` 成为真正主入口
5. 把 `useAIChat` 切薄并接入 store/orchestrator
6. 删除旧 ref 流程与重复副作用
7. 跑 AI Chat 测试集与 lint，最后做手工冒烟核对

## 16. 风险与控制

### 风险 1：切主路径时 UI 展示回退

控制：

- 先补 orchestrator / hook 集成测试
- 保持 UI 输出结构不变，只更换数据来源

### 风险 2：审批链路出现时序问题

控制：

- 所有工具状态更新以 requestId + approvalId / toolCallId 双键校验
- 测试覆盖 follow-up approval 与 main 主动推送状态更新

### 风险 3：历史读写改造引入旧数据兼容问题

控制：

- converter 保持对现有存储字段兼容
- 旧数据恢复路径纳入测试

## 17. 结论

本次收尾采用“硬切主路径，不保留双轨主逻辑”的方案。实现完成后，AI Chat 的 renderer 层将不再由 hook 自行维护请求生命周期和审批状态，而是统一收口到 store + orchestrator；main/preload/renderer 之间的审批事件契约与消息格式也会得到明确边界和测试保护，从而结束当前“看似完成、实则半接线”的状态。
