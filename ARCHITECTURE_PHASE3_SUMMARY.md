/\*\*

- Phase 3: Main Process Integration Summary
-
- AI Chat完整改造 - Main Process部分分析与集成指南
  \*/

## 现状分析

### Main Process现有架构

- **工具审批管理**: `electron/ai/toolApprovalManager.ts`
  - `registerPendingToolApproval()`: 注册待审批的工具
  - `consumePendingToolApproval()`: 消费审批请求（获取后删除）
- **IPC处理**: `electron/ipc/aiHandlers.ts`
  - `ai:chatStream`: 发起对话流
  - `ai:respondToolApproval`: 处理用户审批决策
  - `ai:runUpdate` (emit): 向Renderer推送运行进度
- **运行追踪**: `electron/ai/runTrace.ts`
  - `AIRunTracker`: 追踪完整的执行链路
  - 包含step、artifact等详细信息

### Renderer端新架构

- **Slices**:
  - `RequestSlice`: 管理Request状态（GENERATING → WAITING_APPROVALS → EXECUTING_TOOLS → COMPLETED）
  - `ToolCallSlice`: 管理ToolCall状态机
  - `RetrievalSlice`: 管理检索上下文
- **消息格式统一**:
  - `Message`: 内部统一格式（包含tool approvals、run trace等UI字段）
  - 消息持久化时只保存必要字段
- **Orchestrator**:
  - `ChatOrchestrator`: 协调整个消息流程
  - 聚合IPC事件并更新Store

## 集成方案

### 方案1: 最小改动（推荐）

**时间成本**: 低 | **风险**: 低 | **收益**: 中

做法：

1. 保持Main Process现有架构不变
2. 扩展IPC通道传递新的state信息
3. ChatOrchestrator作为Renderer端的state manager
4. 新旧系统并行运行

实现：

```
Main Process (现有)
  └─ registerPendingToolApproval()
     └─ 通过IPC通知Renderer新建ToolCall

Renderer (新)
  └─ ChatOrchestrator听取IPC
     └─ 创建/更新ToolCall在ToolCallSlice

用户审批
  └─ respondToolApproval (IPC)
     └─ 更新Main端状态
     └─ 通知Renderer更新ToolCallSlice
```

### 方案2: 完全重构

**时间成本**: 高 | **风险**: 高 | **收益**: 高

做法：

1. 在Main Process实现ToolApprovalManager（基于新的state machine）
2. 所有状态变化都通过新IPC通道推送回Renderer
3. 双向状态同步

## Phase 3执行清单

### 3.1 扩展IPC通道

```typescript
// 新增IPC通道（可选）
ipcMain.on('ai:approval-state-changed', (event, data) => {
  // 推送审批状态变化到Renderer
});

ipcMain.on('ai:request-state-changed', (event, data) => {
  // 推送Request状态变化到Renderer
});
```

### 3.2 ChatOrchestrator与Main Process协调

```typescript
// Renderer端已实现的协调
ChatOrchestrator.handleSendMessage()
  → window.ai.chatStream() [IPC to Main]
  → Main Process处理并推送onStreamChunk事件
  → ChatOrchestrator更新Store (appendMessage, updateMessage)

ChatOrchestrator.handleApproveToolCall()
  → window.ai.respondToolApproval() [IPC to Main]
  → Main Process执行工具
  → 推送工具结果
  → ChatOrchestrator更新ToolCall状态
```

### 3.3 验证检查清单

- ✅ ChatOrchestrator能接收IPC事件
- ✅ ToolCallSlice能正确存储工具状态
- ✅ RequestSlice能追踪请求流程
- ✅ Message格式能包含所有UI数据
- ✅ 现有useAIChat继续工作（向后兼容）

## 后续优化机会

### 短期（1-2周）

1. 添加ToolApprovalManager到Main Process侧状态管理
2. 建立双向IPC通道同步状态
3. 编写集成测试验证状态转移

### 中期（1个月）

1. 将useAIChat完全迁移到使用ChatOrchestrator
2. 减少useEffect数量到≤4个
3. 性能优化（减少Store订阅，避免不必要的重渲染）

### 长期（2个月+）

1. 实现完整的undo/redo支持
2. 离线消息队列
3. 实时协作（多用户编辑同一会话）

## 关键文件位置

### Renderer端

- Store Slices: `src/store/slices/{requestSlice,toolCallSlice,retrievalSlice}.ts`
- ChatOrchestrator: `src/features/ai-chat/orchestrators/ChatOrchestrator.ts`
- useAIChat Hook: `src/features/ai-chat/hooks/useAIChat.ts`
- Message转换: `src/features/ai-chat/utils/messageConverter.ts`

### Main Process

- aiHandlers: `electron/ipc/aiHandlers.ts`
- Tool Approval Manager: `electron/ai/toolApprovalManager.ts`
- Tool Registry: `electron/ai/toolRegistry.ts`

## 成功指标

✅ TypeScript编译通过（0 errors）
✅ Renderer端State Machine完整（Request, ToolCall, Retrieval slices）
✅ ChatOrchestrator实现完成
✅ 消息格式统一（Message interface支持所有UI字段）
✅ 现有功能继续工作（向后兼容）
✅ 准备进入集成测试阶段（Phase 4）
