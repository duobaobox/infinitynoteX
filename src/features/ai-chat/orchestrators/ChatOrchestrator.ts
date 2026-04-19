/**
 * ChatOrchestrator
 * 协调整个AI对话流程：消息发送→工具调用→审批→保存
 *
 * 职责：
 * - 管理用户消息发送流程
 * - 订阅IPC事件并更新store状态
 * - 协调工具调用和审批
 * - 处理历史消息保存（仅一次）
 *
 * 注意：这是一个初步实现，完整功能需要在Phase 3完成后进一步优化
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Message } from '../../../store/slices/aiConversationSlice';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import type { NoteReference } from '../types';

export class ChatOrchestrator {
  private store: any;
  private unsubscribes: Array<() => void> = [];
  private messageMap: Map<string, Message> = new Map();

  constructor(store: any = useWorkspaceStore) {
    this.store = store;
  }

  /**
   * 用户发送消息入口
   */
  async handleSendMessage(
    conversationId: string,
    text: string,
    references?: NoteReference[],
  ): Promise<void> {
    try {
      // 1. 创建Request
      const request = this.store.createRequest?.(conversationId);
      if (!request) return;

      // 2. 创建用户消息
      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        references,
      };

      this.store.appendMessage?.(conversationId, userMessage);
      this.store.addMessageToRequest?.(request.id, userMessage.id);
      this.messageMap.set(userMessage.id, userMessage);

      // 3. 发送IPC请求
      await this.sendChatRequest(request.id, text, conversationId, references);

      // 4. 订阅IPC事件
      this.subscribeToStreamEvents(request.id, conversationId);
    } catch (error) {
      console.error('[ChatOrchestrator] Error sending message:', error);
      throw error;
    }
  }

  /**
   * 发送聊天请求到Main Process
   */
  private async sendChatRequest(
    requestId: string,
    text: string,
    conversationId: string,
    references?: NoteReference[],
  ): Promise<void> {
    const messages = this.store.getConversationMessages?.(conversationId) ?? [];
    const filteredMessages = messages
      .filter((m: any) => m.role !== 'user' || m.content.length > 0)
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    await window.ai.chatStream({
      requestId,
      message: text,
      messages: filteredMessages,
      references,
      allowActiveRetrieval: true,
    } as any);
  }

  /**
   * 订阅IPC事件的完整流程
   */
  private subscribeToStreamEvents(requestId: string, conversationId: string): void {
    // 清理旧的订阅
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];

    let aiMessage: Message | null = null;

    // EVENT 1: 流数据块
    this.unsubscribes.push(
      window.ai.onStreamChunk(({ requestId: eventRequestId, chunk }: any) => {
        if (eventRequestId !== requestId) return;

        // 创建或追加AI消息
        if (!aiMessage) {
          aiMessage = {
            id: this.generateMessageId(),
            role: 'assistant',
            content: chunk.delta || '',
            timestamp: Date.now(),
          };
          this.store.appendMessage?.(conversationId, aiMessage);
          this.store.addMessageToRequest?.(requestId, aiMessage.id);
          this.messageMap.set(aiMessage.id, aiMessage);
        } else {
          aiMessage.content += chunk.delta || '';
          this.store.updateMessage?.(conversationId, aiMessage.id, {
            content: aiMessage.content,
          });
          this.messageMap.set(aiMessage.id, aiMessage);
        }
      }),
    );

    // EVENT 2: 工具进度
    this.unsubscribes.push(
      window.ai.onToolProgress(({ requestId: eventRequestId, progress }: any) => {
        if (eventRequestId !== requestId) return;

        if (progress.phase === 'start') {
          // 开始构建新工具调用
          const toolCall = this.store.createToolCall?.(
            requestId,
            progress.toolCallId,
            progress.toolName,
          );
          if (toolCall) {
            this.store.addToolCallToRequest?.(requestId, toolCall.id);
          }
        } else if (progress.phase === 'delta') {
          // 接收工具参数delta
          this.store.updateToolCallDraft?.(progress.toolCallId, progress.inputTextDelta || '');
        }
      }),
    );

    // EVENT 3: 工具审批请求 (使用现有IPC接口名)
    this.unsubscribes.push(
      window.ai.onToolApprovalRequest(({ requestId: eventRequestId, approval }: any) => {
        if (eventRequestId !== requestId) return;

        // 工具参数构建完成
        const toolCall = this.store.getToolCall?.(approval.toolCallId);
        if (toolCall && toolCall.state.type === 'DRAFTING') {
          try {
            const parsedInput = JSON.parse(approval.inputPreview);
            this.store.completeToolCallDraft?.(
              approval.toolCallId,
              parsedInput,
              approval.inputPreview,
            );
          } catch (e) {
            this.store.completeToolCallDraft?.(
              approval.toolCallId,
              approval.inputPreview,
              approval.inputPreview,
            );
          }
        }

        // 转移Request到等待审批
        this.store.transitionRequest?.(requestId, 'WAITING_APPROVALS');
      }),
    );

    // NEW EVENT 4: Main Process推送的审批状态变化
    this.unsubscribes.push(
      window.ai.onApprovalStateChanged(
        ({ requestId: eventRequestId, toolCallId, state, result, error }: any) => {
          if (eventRequestId !== requestId) return;

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
        },
      ),
    );

    // EVENT 5: 流完成
    this.unsubscribes.push(
      window.ai.onStreamDone(({ requestId: eventRequestId }: any) => {
        if (eventRequestId !== requestId) return;

        // 检查是否有待执行的工具
        const request = this.store.getRequest?.(requestId);
        const pendingToolCalls =
          request?.toolCallIds
            ?.map((id: string) => this.store.getToolCall?.(id))
            .filter((tc: any) => tc?.state.type === 'PENDING_APPROVAL') ?? [];

        if (pendingToolCalls.length === 0) {
          // 没有工具需要审批，直接完成
          this.store.completeRequest?.(requestId);
          this.saveConversationHistoryOnce(conversationId);
        }
        // 否则保持WAITING_APPROVALS状态，等待用户交互

        // 清理
        this.cleanup();
      }),
    );
  }

  /**
   * 用户批准工具调用
   */
  async handleApproveToolCall(
    requestId: string,
    toolCallId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      // 1. 立即转移状态到EXECUTING
      this.store.approveToolCall?.(toolCallId);
      this.store.transitionRequest?.(requestId, 'EXECUTING_TOOLS');

      // 2. 通知Main Process
      const result = await window.ai.respondToolApproval({
        approvalId: toolCallId,
        approved: true,
      });

      if (!result.success) {
        throw new Error(result.error || 'Tool approval failed');
      }

      // 3. 处理结果
      if (result.approval) {
        this.store.completeToolCall?.(toolCallId, (result as any).content);
      } else {
        this.store.failToolCall?.(toolCallId, result.error || 'Unknown error');
      }

      // 4. 检查是否还有待处理的工具
      const request = this.store.getRequest?.(requestId);
      const stillPending =
        request?.toolCallIds
          ?.map((id: string) => this.store.getToolCall?.(id))
          .some((tc: any) => tc?.state.type === 'PENDING_APPROVAL') ?? false;

      if (!stillPending) {
        // 全部工具完成，可能有继续内容
        this.store.completeRequest?.(requestId);
        await this.saveConversationHistoryOnce(conversationId);
      }
    } catch (error) {
      console.error('[ChatOrchestrator] Error approving tool:', error);
      this.store.failToolCall?.(
        toolCallId,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * 用户拒绝工具调用
   */
  async handleRejectToolCall(toolCallId: string, conversationId: string): Promise<void> {
    this.store.rejectToolCall?.(toolCallId, 'User rejected');

    // 检查是否还有其他待批准的工具
    const toolCall = this.store.getToolCall?.(toolCallId);
    if (toolCall) {
      const request = this.store.getRequest?.(toolCall.requestId);
      const stillPending =
        request?.toolCallIds
          ?.map((id: string) => this.store.getToolCall?.(id))
          .some((tc: any) => tc?.state.type === 'PENDING_APPROVAL') ?? false;

      if (!stillPending) {
        this.store.completeRequest?.(toolCall.requestId);
        this.saveConversationHistoryOnce(conversationId);
      }
    }
  }

  /**
   * 处理Main Process的审批状态变化
   */
  onApprovalStateChanged(data: {
    requestId: string;
    toolCallId: string;
    state: string;
    timestamp: number;
  }): void {
    // 这是Main Process主动推送的状态同步
    // 用于同步复杂的工具执行过程

    switch (data.state) {
      case 'EXECUTING':
        this.store.approveToolCall?.(data.toolCallId);
        break;
      case 'SUCCESS':
        this.store.completeToolCall?.(data.toolCallId, null);
        break;
      case 'ERROR':
        this.store.failToolCall?.(data.toolCallId, 'Main Process error');
        break;
    }
  }

  /**
   * 只保存一次历史
   */
  private async saveConversationHistoryOnce(conversationId: string): Promise<void> {
    try {
      const messages = this.store.getConversationMessages?.(conversationId) ?? [];
      await window.storage.saveAIConversationMessages(conversationId, messages);
    } catch (error) {
      console.error('[ChatOrchestrator] Error saving conversation:', error);
    }
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    this.messageMap.clear();
  }
}
