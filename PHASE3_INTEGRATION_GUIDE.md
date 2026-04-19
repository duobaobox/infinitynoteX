/\*\*

- Phase 3: Main Process 集成指南
- 如何在现有aiHandlers中集成新的ToolApprovalStateManager
  \*/

/\*\*

- 集成点 1: 初始化
- ==================
- 在 electron/main.ts 的IPC处理初始化中添加：
-
- import { setupAIHandlers } from './ipc/aiHandlers';
- import { toolApprovalStateManager } from './ai/toolApprovalStateManager';
-
- function initializeIPC(mainWindow: BrowserWindow) {
- toolApprovalStateManager.registerRendererWindow(mainWindow);
- setupAIHandlers();
- }
  \*/

/\*\*

- 集成点 2: 在 aiHandlers.ts 中集成状态推送
- ============================================
-
- 现有代码 (line ~400)：
- case 'tool-approval-delta':
- event.sender.send(IPC_CHANNELS.aiToolApprovalRequest, {
-     approvalId: part.approvalId,
-     toolCallId: part.toolCallId,
-     ...
- });
-
- 改造后（添加状态推送）：
- case 'tool-approval-delta':
-     toolApprovalStateManager.notifyToolApprovalRequested({
-       requestId: requestId,
-       approvalId: part.approvalId,
-       toolCallId: part.toolCallId,
-       toolName: part.toolName,
-       inputPreview: JSON.stringify(part.input),
-       timestamp: Date.now(),
-     });
-     event.sender.send(IPC_CHANNELS.aiToolApprovalRequest, {
-       approvalId: part.approvalId,
-       toolCallId: part.toolCallId,
-       ...
-     });
  \*/

/\*\*

- 集成点 3: 在 respondToolApproval 处理中集成状态推送
- ====================================================
-
- 现有代码 (line ~580)：
- ipcMain.handle(aiChannel('respondToolApproval'), async (event, payload) => {
- const pendingApproval = consumePendingToolApproval(payload.approvalId);
-
- 改造后（添加状态推送）：
- // 用户批准时
- toolApprovalStateManager.notifyToolExecutionStarted({
-     requestId: pendingApproval.requestId,
-     approvalId: payload.approvalId,
-     toolCallId: pendingApproval.approval.toolCallId,
-     timestamp: Date.now(),
- });
-
- // 工具执行成功时
- toolApprovalStateManager.notifyToolExecutionSuccess({
-     requestId: pendingApproval.requestId,
-     approvalId: payload.approvalId,
-     toolCallId: pendingApproval.approval.toolCallId,
-     result: matchingToolResult?.output,
-     timestamp: Date.now(),
- });
-
- // 工具执行失败时
- toolApprovalStateManager.notifyToolExecutionError({
-     requestId: pendingApproval.requestId,
-     approvalId: payload.approvalId,
-     toolCallId: pendingApproval.approval.toolCallId,
-     error: errorMessage,
-     timestamp: Date.now(),
- });
-
- // 用户拒绝时
- if (!payload.approved) {
-     toolApprovalStateManager.notifyToolRejected({
-       requestId: pendingApproval.requestId,
-       approvalId: payload.approvalId,
-       toolCallId: pendingApproval.approval.toolCallId,
-       timestamp: Date.now(),
-     });
- }
  \*/

/\*\*

- 集成点 4: 在 preload.ts 中暴露新的IPC通道
- ==========================================
-
- contextBridge.exposeInMainWorld('ai', {
- // ... 现有方法 ...
-
- // NEW: 监听审批状态变化
- onApprovalStateChanged: (callback: (data: any) => void) => {
-     ipcRenderer.on('ai:approval-state-changed', (_event, data) => {
-       callback(data);
-     });
- },
- });
  \*/

/\*\*

- 集成点 5: ChatOrchestrator 中订阅新的IPC事件
- =============================================
-
- 在 src/features/ai-chat/orchestrators/ChatOrchestrator.ts 中：
-
- private subscribeToApprovalStateChanges(requestId: string): void {
- this.unsubscribes.push(
-     window.ai.onApprovalStateChanged(({ requestId: eventRequestId, approvalId, state, result, error }) => {
-       if (eventRequestId !== requestId) return;
-
-       switch (state) {
-         case 'PENDING_APPROVAL':
-           // ToolCall已转移到PENDING_APPROVAL
-           break;
-         case 'EXECUTING':
-           this.store.approveToolCall?.(approvalId);
-           break;
-         case 'SUCCESS':
-           this.store.completeToolCall?.(approvalId, result);
-           break;
-         case 'ERROR':
-           this.store.failToolCall?.(approvalId, error);
-           break;
-         case 'REJECTED':
-           this.store.rejectToolCall?.(approvalId, 'User rejected');
-           break;
-       }
-     })
- );
- }
  \*/

/\*\*

- 验证清单
- ========
-
- ✅ toolApprovalStateManager.ts 已创建
- ⏳ 在 aiHandlers.ts 中集成状态推送（需要在实施时完成）
- ⏳ 在 preload.ts 中暴露新的IPC通道（需要在实施时完成）
- ⏳ 在 ChatOrchestrator 中订阅状态变化（需要在实施时完成）
  \*/

export const INTEGRATION_SUMMARY = {
phase: 'Phase 3',
component: 'Main Process State Management Enhancement',
files: {
created: ['electron/ai/toolApprovalStateManager.ts'],
modified: [
'electron/ipc/aiHandlers.ts (tool approval events)',
'electron/main.ts (initialization)',
'electron/preload.ts (IPC channel exposure)',
],
source: ['src/features/ai-chat/orchestrators/ChatOrchestrator.ts (integration)'],
},
newIpcChannels: ['ai:approval-state-changed'],
strategy: 'Non-breaking enhancement - adds state push without modifying existing logic',
};
