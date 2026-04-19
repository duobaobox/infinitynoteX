/**
 * Enhanced Tool Approval Manager - 工具审批状态管理增强
 * 添加状态推送和Renderer同步能力
 */

import type { BrowserWindow } from 'electron';

export interface ApprovalStateChangeEvent {
  requestId: string;
  toolCallId: string;
  approvalId: string;
  state: 'PENDING_APPROVAL' | 'EXECUTING' | 'SUCCESS' | 'ERROR' | 'REJECTED';
  result?: unknown;
  error?: string;
  timestamp: number;
}

/**
 * ToolApprovalStateManager
 * 追踪工具审批的状态变化，并推送到Renderer
 */
export class ToolApprovalStateManager {
  private approvalStates = new Map<string, ApprovalStateChangeEvent>();
  private rendererWindows: Set<BrowserWindow> = new Set();

  /**
   * 注册Renderer窗口用于接收状态更新
   */
  registerRendererWindow(window: BrowserWindow | null): void {
    if (window && !window.isDestroyed()) {
      this.rendererWindows.add(window);
    }
  }

  /**
   * 注销Renderer窗口
   */
  unregisterRendererWindow(window: BrowserWindow | null): void {
    if (window) {
      this.rendererWindows.delete(window);
    }
  }

  /**
   * 记录工具审批状态变化
   */
  recordApprovalStateChange(event: ApprovalStateChangeEvent): void {
    this.approvalStates.set(event.approvalId, event);

    // 推送状态变化到所有Renderer窗口
    this.broadcastToRenderer('ai:approval-state-changed', {
      requestId: event.requestId,
      toolCallId: event.toolCallId,
      approvalId: event.approvalId,
      state: event.state,
      ...(event.result ? { result: event.result } : {}),
      ...(event.error ? { error: event.error } : {}),
      timestamp: event.timestamp,
    });
  }

  /**
   * 获取特定审批的状态
   */
  getApprovalState(approvalId: string): ApprovalStateChangeEvent | undefined {
    return this.approvalStates.get(approvalId);
  }

  /**
   * 获取请求下所有待审批工具的状态
   */
  getRequestApprovalStates(requestId: string): ApprovalStateChangeEvent[] {
    return Array.from(this.approvalStates.values()).filter(
      (event) => event.requestId === requestId,
    );
  }

  /**
   * 清理已完成请求的状态
   */
  clearRequestApprovals(requestId: string): void {
    for (const [approvalId, event] of this.approvalStates.entries()) {
      if (event.requestId === requestId) {
        this.approvalStates.delete(approvalId);
      }
    }
  }

  /**
   * 广播事件到所有Renderer窗口
   */
  private broadcastToRenderer(channel: string, data: unknown): void {
    for (const window of this.rendererWindows) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    }
  }

  /**
   * 推送工具审批请求到Renderer
   */
  notifyToolApprovalRequested(data: {
    requestId: string;
    approvalId: string;
    toolCallId: string;
    toolName: string;
    inputPreview: string;
    timestamp: number;
  }): void {
    this.broadcastToRenderer('ai:tool-approval-requested', data);

    // 记录PENDING_APPROVAL状态
    this.recordApprovalStateChange({
      requestId: data.requestId,
      toolCallId: data.toolCallId,
      approvalId: data.approvalId,
      state: 'PENDING_APPROVAL',
      timestamp: data.timestamp,
    });
  }

  /**
   * 推送工具执行开始事件
   */
  notifyToolExecutionStarted(data: {
    requestId: string;
    approvalId: string;
    toolCallId: string;
    timestamp: number;
  }): void {
    this.recordApprovalStateChange({
      requestId: data.requestId,
      toolCallId: data.toolCallId,
      approvalId: data.approvalId,
      state: 'EXECUTING',
      timestamp: data.timestamp,
    });
  }

  /**
   * 推送工具执行成功
   */
  notifyToolExecutionSuccess(data: {
    requestId: string;
    approvalId: string;
    toolCallId: string;
    result: unknown;
    timestamp: number;
  }): void {
    this.recordApprovalStateChange({
      requestId: data.requestId,
      toolCallId: data.toolCallId,
      approvalId: data.approvalId,
      state: 'SUCCESS',
      result: data.result,
      timestamp: data.timestamp,
    });
  }

  /**
   * 推送工具执行失败
   */
  notifyToolExecutionError(data: {
    requestId: string;
    approvalId: string;
    toolCallId: string;
    error: string;
    timestamp: number;
  }): void {
    this.recordApprovalStateChange({
      requestId: data.requestId,
      toolCallId: data.toolCallId,
      approvalId: data.approvalId,
      state: 'ERROR',
      error: data.error,
      timestamp: data.timestamp,
    });
  }

  /**
   * 推送工具执行被拒绝
   */
  notifyToolRejected(data: {
    requestId: string;
    approvalId: string;
    toolCallId: string;
    timestamp: number;
  }): void {
    this.recordApprovalStateChange({
      requestId: data.requestId,
      toolCallId: data.toolCallId,
      approvalId: data.approvalId,
      state: 'REJECTED',
      timestamp: data.timestamp,
    });
  }
}

/**
 * 全局单例
 */
export const toolApprovalStateManager = new ToolApprovalStateManager();
