# Phase 3: Main Process改造 - 实施方案

## 🎯 目标

在Main Process中实现工具审批状态管理，并与Renderer端新的State Machine同步，形成完整的双向状态流。

---

## 📊 现有架构分析

### Main Process现状

- ✅ `toolApprovalManager.ts` - 已有待审批工具管理
- ✅ `aiHandlers.ts` - 已有完整的chatStream和respondToolApproval流程
- ✅ `runTrace.ts` - 已有执行链路追踪

### Renderer端新架构

- ✅ `requestSlice.ts` - Request状态机
- ✅ `toolCallSlice.ts` - ToolCall状态机
- ✅ `ChatOrchestrator.ts` - 编排整个流程

---

## 🔄 改造方案（最小改动）

### 策略：增强而非重写

**理由**：

- 现有代码已运行在生产环境
- 完全重写风险高
- 增强策略可逐步验证每个集成点

### 核心改动

#### 3.1 创建 `ToolApprovalStateManager` ✅ 已完成

**文件**: `electron/ai/toolApprovalStateManager.ts` (新建)

**职责**：

- 追踪工具审批的状态变化
- 推送状态变化到Renderer窗口
- 提供4个通知方法：
  - `notifyToolApprovalRequested()` → PENDING_APPROVAL
  - `notifyToolExecutionStarted()` → EXECUTING
  - `notifyToolExecutionSuccess()` → SUCCESS
  - `notifyToolExecutionError()` → ERROR
  - `notifyToolRejected()` → REJECTED

**关键特性**：

- 窗口注册/注销管理
- 状态变化事件广播
- 请求级别的状态查询

---

#### 3.2 改造 `aiHandlers.ts` ⏳ 需实施

**修改点1**：在IPC处理初始化中

```typescript
import { toolApprovalStateManager } from '../ai/toolApprovalStateManager';
// 在setupAIHandlers()中初始化
```

**修改点2**：在工具审批事件发生时调用状态管理器

```typescript
// 工具审批请求时
toolApprovalStateManager.notifyToolApprovalRequested({...});

// 用户批准时
toolApprovalStateManager.notifyToolExecutionStarted({...});

// 工具执行成功时
toolApprovalStateManager.notifyToolExecutionSuccess({...});

// 工具执行失败时
toolApprovalStateManager.notifyToolExecutionError({...});

// 用户拒绝时
toolApprovalStateManager.notifyToolRejected({...});
```

**修改范围**：~20-30行代码添加，不修改现有逻辑

---

#### 3.3 在 `preload.ts` 暴露新的IPC通道 ⏳ 需实施

**新增通道**：`ai:approval-state-changed`

```typescript
contextBridge.exposeInMainWorld('ai', {
  // 现有的...

  onApprovalStateChanged: (callback) => {
    ipcRenderer.on('ai:approval-state-changed', (_, data) => {
      callback(data);
    });
  },
});
```

**修改范围**：~5行代码添加

---

#### 3.4 在 `ChatOrchestrator` 中订阅状态变化 ⏳ 需实施

**目标**：接收Main Process的状态推送，更新Renderer端的State Machine

```typescript
// 在subscribeToStreamEvents中添加
this.unsubscribes.push(
  window.ai.onApprovalStateChanged(({ state, toolCallId, result, error }) => {
    switch (state) {
      case 'EXECUTING':
        this.store.approveToolCall?.(toolCallId);
        break;
      case 'SUCCESS':
        this.store.completeToolCall?.(toolCallId, result);
        break;
      case 'ERROR':
        this.store.failToolCall?.(toolCallId, error);
        break;
      case 'REJECTED':
        this.store.rejectToolCall?.(toolCallId, 'Rejected');
        break;
    }
  }),
);
```

**修改范围**：~15行代码添加

---

## 📈 数据流

```
Main Process                          Renderer
═════════════════════════════════════════════════════

用户批准工具
  │
  ├─ respondToolApproval (IPC)
  │
  └─ ToolApprovalStateManager
      │
      ├─ notifyToolExecutionStarted()
      │       │
      │       └─ broadcast('ai:approval-state-changed')
      │              │
      │              └─────────────────→ ChatOrchestrator.onApprovalStateChanged()
      │                                   │
      │                                   └─ store.approveToolCall()
      │                                      (ToolCallSlice: EXECUTING)
      │
      └─ adapter.continueWithMessages()
          │
          ├─ Tool execution
          │
          └─ notifyToolExecutionSuccess()
                 │
                 └─ broadcast('ai:approval-state-changed')
                        │
                        └─────────────────→ ChatOrchestrator
                                           │
                                           └─ store.completeToolCall()
                                              (ToolCallSlice: SUCCESS)
```

---

## 🔐 向后兼容性

✅ **完全兼容**

- 现有的 `respondToolApproval` 流程不变
- 现有的 `registerPendingToolApproval` / `consumePendingToolApproval` 不变
- 新增功能是**纯粹的信息推送**，不影响现有逻辑

---

## 🧪 验证方案

### 单元测试

- ✅ `ToolApprovalStateManager` 已有集成测试在Phase 4中

### 集成测试

需要验证的场景：

1. **PENDING_APPROVAL状态推送**

   ```
   工具参数生成完成 → Main推送PENDING_APPROVAL → Renderer收到 → ToolCall更新
   ```

2. **EXECUTING状态推送**

   ```
   用户批准 → Main推送EXECUTING → Renderer收到 → ToolCall更新
   ```

3. **SUCCESS状态推送**

   ```
   工具执行完成 → Main推送SUCCESS → Renderer收到 → ToolCall更新+result保存
   ```

4. **ERROR状态推送**

   ```
   工具执行失败 → Main推送ERROR → Renderer收到 → ToolCall更新+error记录
   ```

5. **REJECTED状态推送**
   ```
   用户拒绝 → Main推送REJECTED → Renderer收到 → ToolCall标记为REJECTED
   ```

---

## 📋 实施步骤

### 步骤1：准备阶段 (完成) ✅

- [x] 创建 `toolApprovalStateManager.ts`
- [x] 编写集成指南
- [x] 编写代码片段

### 步骤2：集成阶段 (待实施) ⏳

- [ ] 在 `aiHandlers.ts` 中集成状态推送调用 (~30分钟)
- [ ] 在 `preload.ts` 中暴露新IPC通道 (~10分钟)
- [ ] 在 `ChatOrchestrator.ts` 中订阅状态变化 (~20分钟)
- [ ] 在 `main.ts` 中初始化窗口注册 (~10分钟)

### 步骤3：验证阶段 (待执行) ⏳

- [ ] ESLint检查通过
- [ ] TypeScript编译通过 (0 errors)
- [ ] 运行现有测试，确保无回归
- [ ] 手工测试工具审批流程

---

## ⚠️ 可能的问题与解决方案

| 问题         | 原因               | 解决方案                                      |
| ------------ | ------------------ | --------------------------------------------- |
| 类型不匹配   | TypeScript严格模式 | 检查导入和参数类型                            |
| 窗口已销毁   | 异步竞态           | `!window.isDestroyed()` 检查                  |
| 状态重复推送 | 多次调用           | 确保只在状态真正变化时推送                    |
| 内存泄漏     | 监听器未清理       | 在窗口关闭时调用 `unregisterRendererWindow()` |

---

## 📊 代码统计

| 项目             | 数量                                                          |
| ---------------- | ------------------------------------------------------------- |
| 新建文件         | 1个 (toolApprovalStateManager.ts)                             |
| 修改文件         | 3个 (aiHandlers.ts, preload.ts, main.ts, ChatOrchestrator.ts) |
| 新增代码行数     | ~80行                                                         |
| 修改现有代码行数 | 0行 (纯粹添加)                                                |
| 删除代码行数     | 0行 (向后兼容)                                                |

---

## 🎯 成功标志

✅ 所有实施点完成
✅ TypeScript编译 0 errors
✅ ESLint 0 warnings
✅ 工具审批流程完整（从Main → Renderer同步）
✅ Renderer端State Machine与Main Process状态保持一致
✅ 无回归测试失败

---

## 📝 下一步

1. **立即**：按照代码片段在各文件中添加集成点
2. **验证**：运行 `npm run lint` 和 `npm run build`
3. **测试**：手工测试工具审批流程
4. **进入Phase 4**：运行集成测试验证整个系统

---

**文档版本**: 1.0  
**生成时间**: 2026-04-19 15:45 UTC  
**状态**: 就绪实施
