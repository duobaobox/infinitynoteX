/\*\*

- Phase 3: aiHandlers.ts 集成代码片段
- 这些代码片段显示了如何在现有aiHandlers中添加新的状态推送
  \*/

// ========================================================================
// 片段 1: 导入新的状态管理器 (在 aiHandlers.ts 顶部)
// ========================================================================

/\*
添加到现有导入中：

import { toolApprovalStateManager } from '../ai/toolApprovalStateManager';
\*/

// ========================================================================
// 片段 2: 在 registerPendingToolApproval 时推送状态 (around line 400-450)
// ========================================================================

/\*
在处理 'tool-approval-delta' 流事件时：

case 'tool-approval-delta': {
// 现有代码...
const approval = buildToolApprovalRequest(...);
registerPendingToolApproval({
approval,
...other fields
});

// 新增：推送状态变化到Renderer
toolApprovalStateManager.notifyToolApprovalRequested({
requestId: requestId,
approvalId: approval.approvalId,
toolCallId: approval.toolCallId,
toolName: approval.toolName,
inputPreview: approval.inputPreview,
timestamp: Date.now(),
});

event.sender.send(IPC_CHANNELS.aiToolApprovalRequest, {
approvalId: approval.approvalId,
...
});
break;
}
\*/

// ========================================================================
// 片段 3: 在 respondToolApproval 处理中 (around line 611-650)
// ========================================================================

/\*
修改 respondToolApproval 处理器：

ipcMain.handle(aiChannel('respondToolApproval'), async (event, payload) => {
const pendingApproval = consumePendingToolApproval(payload.approvalId);

if (!pendingApproval) {
return {
success: false,
error: '审批请求不存在或已过期。'
};
}

try {
if (payload.approved) {
// 新增：推送EXECUTING状态
toolApprovalStateManager.notifyToolExecutionStarted({
requestId: pendingApproval.requestId,
approvalId: payload.approvalId,
toolCallId: pendingApproval.approval.toolCallId,
timestamp: Date.now(),
});
} else {
// 新增：推送REJECTED状态
toolApprovalStateManager.notifyToolRejected({
requestId: pendingApproval.requestId,
approvalId: payload.approvalId,
toolCallId: pendingApproval.approval.toolCallId,
timestamp: Date.now(),
});
}

    // 现有的adapter.continueWithMessages逻辑...
    const result = await adapter.continueWithMessages(continuationMessages, {...});
    const matchingToolResult = result.toolResults.find(...);

    if (payload.approved && matchingToolResult) {
      // 新增：推送SUCCESS状态
      toolApprovalStateManager.notifyToolExecutionSuccess({
        requestId: pendingApproval.requestId,
        approvalId: payload.approvalId,
        toolCallId: pendingApproval.approval.toolCallId,
        result: matchingToolResult.output,
        timestamp: Date.now(),
      });
    }

    // 现有的后续逻辑继续...
    return { success: true, approval: nextApproval, ... };

} catch (error) {
// 新增：推送ERROR状态
toolApprovalStateManager.notifyToolExecutionError({
requestId: pendingApproval.requestId,
approvalId: payload.approvalId,
toolCallId: pendingApproval.approval.toolCallId,
error: error instanceof Error ? error.message : 'Unknown error',
timestamp: Date.now(),
});

    return {
      success: false,
      error: ...
    };

}
});
\*/

// ========================================================================
// 片段 4: 在 main.ts 初始化 (around setupAIHandlers call)
// ========================================================================

/\*
在 electron/main.ts 中：

import { toolApprovalStateManager } from './ai/toolApprovalStateManager';

function setupApplicationHandlers(mainWindow: BrowserWindow) {
// 注册Renderer窗口接收审批状态更新
toolApprovalStateManager.registerRendererWindow(mainWindow);

// 原有的setup...
setupAIHandlers();
// ...

// 窗口关闭时注销
mainWindow.on('closed', () => {
toolApprovalStateManager.unregisterRendererWindow(mainWindow);
});
}
\*/

// ========================================================================
// 片段 5: 在 preload.ts 中暴露新通道
// ========================================================================

/\*
在 electron/preload.ts 的 contextBridge.exposeInMainWorld 中添加：

contextBridge.exposeInMainWorld('ai', {
// 现有的方法...
chatStream: (...) => ipcRenderer.invoke('ai:chatStream', ...),
respondToolApproval: (...) => ipcRenderer.invoke('ai:respondToolApproval', ...),

// 新增的方法
onApprovalStateChanged: (callback: (data: any) => void) => {
const listener = (\_event: any, data: any) => callback(data);
ipcRenderer.on('ai:approval-state-changed', listener);
return () => {
ipcRenderer.off('ai:approval-state-changed', listener);
};
},
});
\*/

// ========================================================================
// 片段 6: 在 ChatOrchestrator 中订阅 (src/features/ai-chat/orchestrators/)
// ========================================================================

/\*
在 ChatOrchestrator.ts 的 subscribeToStreamEvents 方法中添加：

// NEW: 订阅Main Process的审批状态变化
this.unsubscribes.push(
window.ai.onApprovalStateChanged(({ requestId: eventRequestId, toolCallId, approvalId, state, result, error, timestamp }) => {
if (eventRequestId !== requestId) return;

    console.log(`[ChatOrchestrator] Approval state changed: ${toolCallId} -> ${state}`);

    switch (state) {
      case 'EXECUTING':
        // Main Process已开始执行工具
        this.store.approveToolCall?.(toolCallId);
        break;
      case 'SUCCESS':
        // 工具执行成功
        this.store.completeToolCall?.(toolCallId, result);
        break;
      case 'ERROR':
        // 工具执行失败
        this.store.failToolCall?.(toolCallId, error || 'Execution error');
        break;
      case 'REJECTED':
        // Main Process确认用户拒绝
        this.store.rejectToolCall?.(toolCallId, 'User rejected');
        break;
      case 'PENDING_APPROVAL':
        // Main Process推送了待审批状态（可选处理）
        break;
    }

})
);
\*/

export const INTEGRATION_SNIPPETS = {
description: 'Phase 3 Main Process integration code snippets',
totalSnippets: 6,
status: 'Ready for implementation',
estimatedTime: '1-2 hours',
riskLevel: 'Low (non-breaking, additive changes)',
};
