/**
 * ChatOrchestrator
 * 协调整个 AI Chat 的请求生命周期、工具审批与历史持久化。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ChatMessage } from '../../../services/aiConfig';
import type { AIConversationSource, AIToolApproval, NoteReference } from '../../../services/types';
import type { Message } from '../../../store/slices/aiConversationSlice';
import type { RagSource } from '../../../store/slices/retrievalSlice';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { mergeToolApprovals, resolveApprovalContinuationContent } from '../approvalFlow';
import { splitReasoningContent } from '../utils/messageConverter';
import {
  persistedMessagesToStoreMessages,
  storeMessagesToPersistedMessages,
} from '../utils/persistenceConverter';

type PersistOptions = {
  autoSave?: boolean;
  source?: AIConversationSource;
  sourceEntityId?: string | null;
  onTitleChange?: (title: string) => void;
};

export interface SendMessageOptions extends PersistOptions {
  conversationId: string;
  text: string;
  references?: NoteReference[];
  allowActiveRetrieval?: boolean;
  useFallbackRag?: boolean;
}

interface RequestContext {
  requestId: string;
  conversationId: string;
  assistantMessageId: string;
  persistOptions: PersistOptions;
}

export class ChatOrchestrator {
  private store: any;
  private requestContexts = new Map<string, RequestContext>();
  private requestSubscriptions = new Map<string, Array<() => void>>();

  constructor(store: any = useWorkspaceStore) {
    this.store = store;
  }

  private getStore(): any {
    return typeof this.store?.getState === 'function' ? this.store.getState() : this.store;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private getConversationMessages(conversationId: string): Message[] {
    return this.getStore().getConversationMessages?.(conversationId) ?? [];
  }

  private buildHistoryMessages(conversationId: string): ChatMessage[] {
    return this.getConversationMessages(conversationId)
      .filter((message) => message.role !== 'assistant' || message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content,
        references: message.references,
      }));
  }

  private createAssistantMessage(
    requestId: string,
    conversationId: string,
    initial: Partial<Message> = {},
  ): string {
    const assistantMessage: Message = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      relatedToolCallIds: [],
      ...initial,
    };

    const store = this.getStore();
    store.appendMessage?.(conversationId, assistantMessage);
    store.addMessageToRequest?.(requestId, assistantMessage.id);
    this.requestContexts.set(requestId, {
      requestId,
      conversationId,
      assistantMessageId: assistantMessage.id,
      persistOptions: {},
    });

    return assistantMessage.id;
  }

  private getRequestContext(requestId: string): RequestContext | null {
    return this.requestContexts.get(requestId) ?? null;
  }

  private updateContextOptions(requestId: string, persistOptions: PersistOptions): void {
    const context = this.requestContexts.get(requestId);
    if (!context) {
      return;
    }

    this.requestContexts.set(requestId, {
      ...context,
      persistOptions: {
        ...context.persistOptions,
        ...persistOptions,
      },
    });
  }

  private updateMessage(
    conversationId: string,
    messageId: string,
    updater: (message: Message) => Partial<Message>,
  ): void {
    const current = this.getConversationMessages(conversationId).find(
      (message) => message.id === messageId,
    );
    if (!current) {
      return;
    }

    this.getStore().updateMessage?.(conversationId, messageId, updater(current));
  }

  private updateAssistantMessage(
    requestId: string,
    updater: (message: Message) => Partial<Message>,
  ): void {
    const context = this.getRequestContext(requestId);
    if (!context) {
      return;
    }

    this.updateMessage(context.conversationId, context.assistantMessageId, updater);
  }

  private appendAssistantContent(
    requestId: string,
    chunk: { delta?: string; reasoningDelta?: string },
  ): void {
    this.updateAssistantMessage(requestId, (message) => ({
      content: `${message.content}${chunk.delta ?? ''}`,
      reasoning: `${message.reasoning ?? ''}${chunk.reasoningDelta ?? ''}` || undefined,
    }));
  }

  private addRelatedToolCallId(requestId: string, toolCallId: string): void {
    this.updateAssistantMessage(requestId, (message) => ({
      relatedToolCallIds: Array.from(new Set([...(message.relatedToolCallIds ?? []), toolCallId])),
    }));
  }

  private mergeApprovalIntoAssistant(requestId: string, approval: AIToolApproval): void {
    this.updateAssistantMessage(requestId, (message) => ({
      toolApprovals: mergeToolApprovals(message.toolApprovals, [approval]),
      relatedToolCallIds: Array.from(
        new Set([...(message.relatedToolCallIds ?? []), approval.toolCallId]),
      ),
    }));
  }

  private updateApprovalStateInAssistant(
    requestId: string,
    approvalId: string,
    patch: Partial<AIToolApproval>,
  ): void {
    this.updateAssistantMessage(requestId, (message) => ({
      toolApprovals: (message.toolApprovals ?? []).map((approval) =>
        approval.approvalId === approvalId ? { ...approval, ...patch } : approval,
      ),
    }));
  }

  private appendApprovalContinuation(
    requestId: string,
    latestApproval: AIToolApproval,
    content?: string,
  ): void {
    const parsed = splitReasoningContent(content ?? '');

    this.updateAssistantMessage(requestId, (message) => ({
      content: resolveApprovalContinuationContent({
        currentContent: message.content,
        existingApprovals: message.toolApprovals,
        latestApproval,
        continuationContent: parsed.content,
      }),
      reasoning:
        [message.reasoning, parsed.reasoning].filter(Boolean).join('\n').trim() || undefined,
    }));
  }

  private normalizeToolApprovalEvent(data: any): AIToolApproval {
    if (data?.approval) {
      return data.approval as AIToolApproval;
    }

    return {
      approvalId: data.approvalId,
      toolCallId: data.toolCallId,
      toolName: data.toolName ?? 'tool',
      title: data.toolName ? `待审批工具：${data.toolName}` : '待审批工具',
      description: 'AI 请求执行工具调用，等待用户确认。',
      status: 'pending',
      preview: data.inputPreview,
    };
  }

  private ensureToolCallForApproval(requestId: string, approval: AIToolApproval): void {
    const store = this.getStore();
    const existing = store.getToolCall?.(approval.toolCallId);

    if (!existing) {
      const toolCall = store.createToolCall?.(requestId, approval.toolCallId, approval.toolName);
      if (toolCall) {
        store.addToolCallToRequest?.(requestId, toolCall.id);
      }
    }

    const preview = approval.preview ?? approval.description ?? '';
    store.completeToolCallDraft?.(approval.toolCallId, preview, preview);
    store.setToolCallApproval?.(approval.toolCallId, approval.approvalId);
    this.addRelatedToolCallId(requestId, approval.toolCallId);
  }

  private findToolCallByApprovalId(approvalId: string): any {
    const toolCalls = Object.values(this.getStore().toolCalls ?? {}) as Array<any>;
    return toolCalls.find((toolCall) => toolCall.approvalId === approvalId) ?? null;
  }

  private registerRequestSubscription(requestId: string, unsubscribe: () => void): void {
    const existing = this.requestSubscriptions.get(requestId) ?? [];
    existing.push(unsubscribe);
    this.requestSubscriptions.set(requestId, existing);
  }

  private clearRequestSubscriptions(requestId: string): void {
    const unsubscribes = this.requestSubscriptions.get(requestId) ?? [];
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    this.requestSubscriptions.delete(requestId);
  }

  private cleanupRequest(requestId: string): void {
    this.clearRequestSubscriptions(requestId);
    this.requestContexts.delete(requestId);
  }

  private async buildFallbackRagData(
    text: string,
    useFallbackRag: boolean,
  ): Promise<{
    ragContext?: {
      results: Array<{
        noteId: string;
        noteTitle: string;
        excerpt: string;
        score: number;
      }>;
    };
    ragSources?: RagSource[];
  }> {
    if (!useFallbackRag || !window.knowledge?.search) {
      this.getStore().clearRetrievalContext?.();
      return {};
    }

    this.getStore().startRetrieval?.(text, 'prefetch');

    try {
      const searchResults = await window.knowledge.search(text, 3);
      if (!searchResults?.length) {
        this.getStore().completeRetrieval?.([]);
        return {};
      }

      const ragSources = searchResults.map((result, index) => ({
        key: index + 1,
        title: result.noteTitle,
        description: result.excerpt.slice(0, 100) + (result.excerpt.length > 100 ? '...' : ''),
        noteId: result.noteId,
      }));

      this.getStore().completeRetrieval?.(ragSources);

      return {
        ragContext: {
          results: searchResults.map((result) => ({
            noteId: result.noteId,
            noteTitle: result.noteTitle,
            excerpt: result.excerpt,
            score: result.score,
          })),
        },
        ragSources,
      };
    } catch (error) {
      console.warn('[ChatOrchestrator] Knowledge search failed:', error);
      this.getStore().cancelRetrieval?.();
      return {};
    }
  }

  async loadConversation(
    conversationId: string,
    options?: { onTitleChange?: (title: string) => void },
  ): Promise<void> {
    if (!conversationId) {
      return;
    }

    const conversation = await window.storage.getAIConversation(conversationId);
    this.getStore().setConversationMessages?.(
      conversationId,
      persistedMessagesToStoreMessages(conversation.messages ?? []),
    );
    options?.onTitleChange?.(conversation.title || 'AI 对话');
  }

  async clearConversation(conversationId: string, options: PersistOptions = {}): Promise<void> {
    this.getStore().clearConversationMessages?.(conversationId);

    if (!options.autoSave) {
      return;
    }

    await this.saveConversation(conversationId, options);
  }

  async abortRequest(requestId: string): Promise<void> {
    await window.ai.abortStream(requestId);
  }

  async handleSendMessage(
    conversationIdOrOptions: string | SendMessageOptions,
    text?: string,
    references?: NoteReference[],
  ): Promise<{ conversationId: string; requestId: string } | void> {
    const options: SendMessageOptions =
      typeof conversationIdOrOptions === 'string'
        ? {
            conversationId: conversationIdOrOptions,
            text: text ?? '',
            references,
            autoSave: true,
            allowActiveRetrieval: true,
          }
        : conversationIdOrOptions;

    if (!options.text.trim()) {
      return;
    }

    const history = this.buildHistoryMessages(options.conversationId);
    const { ragContext, ragSources } = await this.buildFallbackRagData(
      options.text,
      Boolean(options.useFallbackRag),
    );

    const store = this.getStore();
    const fallbackRequestId = this.generateRequestId();
    const request = store.createRequest?.(options.conversationId) ?? {
      id: fallbackRequestId,
      conversationId: options.conversationId,
    };

    const requestKey = request.id;

    const userMessage: Message = {
      id: this.generateMessageId(),
      role: 'user',
      content: options.text,
      timestamp: Date.now(),
      references: options.references,
    };

    store.appendMessage?.(options.conversationId, userMessage);
    store.addMessageToRequest?.(requestKey, userMessage.id);

    const assistantMessageId = this.createAssistantMessage(requestKey, options.conversationId, {
      ragSources,
    });
    this.updateContextOptions(requestKey, {
      autoSave: options.autoSave,
      source: options.source,
      sourceEntityId: options.sourceEntityId,
      onTitleChange: options.onTitleChange,
    });
    this.requestContexts.set(requestKey, {
      requestId: requestKey,
      conversationId: options.conversationId,
      assistantMessageId,
      persistOptions: {
        autoSave: options.autoSave,
        source: options.source,
        sourceEntityId: options.sourceEntityId,
        onTitleChange: options.onTitleChange,
      },
    });

    this.subscribeToStreamEvents(requestKey, options.conversationId);

    try {
      await window.ai.chatStream({
        requestId: requestKey,
        message: options.text,
        messages: history,
        references: options.references,
        allowActiveRetrieval: options.allowActiveRetrieval ?? true,
        ragContext,
      });
      return { conversationId: options.conversationId, requestId: requestKey };
    } catch (error) {
      store.setRequestError?.(requestKey, error instanceof Error ? error.message : String(error));
      this.cleanupRequest(requestKey);
      throw error;
    }
  }

  private subscribeToStreamEvents(requestId: string, conversationId: string): void {
    this.clearRequestSubscriptions(requestId);

    this.registerRequestSubscription(
      requestId,
      window.ai.onStreamChunk(({ requestId: eventRequestId, chunk }: any) => {
        if (eventRequestId !== requestId) return;
        this.appendAssistantContent(requestId, chunk);
      }),
    );

    this.registerRequestSubscription(
      requestId,
      window.ai.onToolProgress(({ requestId: eventRequestId, progress }: any) => {
        if (eventRequestId !== requestId) return;

        const store = this.getStore();
        if (progress.phase === 'start') {
          const toolCall = store.createToolCall?.(
            requestId,
            progress.toolCallId,
            progress.toolName,
          );
          if (toolCall) {
            store.addToolCallToRequest?.(requestId, toolCall.id);
            this.addRelatedToolCallId(requestId, toolCall.id);
          }
          return;
        }

        store.updateToolCallDraft?.(progress.toolCallId, progress.inputTextDelta || '');
      }),
    );

    this.registerRequestSubscription(
      requestId,
      window.ai.onToolApprovalRequest((data: any) => {
        const eventRequestId = data?.requestId;
        if (eventRequestId !== requestId) return;

        const approval = this.normalizeToolApprovalEvent(data);
        this.ensureToolCallForApproval(requestId, approval);
        this.mergeApprovalIntoAssistant(requestId, approval);
        this.getStore().transitionRequest?.(requestId, 'WAITING_APPROVALS');

        const persistOptions = this.getRequestContext(requestId)?.persistOptions;
        void this.saveConversation(conversationId, persistOptions);
      }),
    );

    if (window.ai.onRunUpdate) {
      this.registerRequestSubscription(
        requestId,
        window.ai.onRunUpdate(({ requestId: eventRequestId, run }: any) => {
          if (eventRequestId !== requestId) return;
          this.updateAssistantMessage(requestId, () => ({ runTrace: run }));
        }),
      );
    }

    if (window.ai.onApprovalStateChanged) {
      this.registerRequestSubscription(
        requestId,
        window.ai.onApprovalStateChanged(
          ({ requestId: eventRequestId, toolCallId, approvalId, state, result, error }: any) => {
            if (eventRequestId !== requestId) return;

            const store = this.getStore();

            switch (state) {
              case 'EXECUTING':
                store.approveToolCall?.(toolCallId);
                store.transitionRequest?.(requestId, 'EXECUTING_TOOLS');
                this.updateApprovalStateInAssistant(requestId, approvalId, {
                  status: 'processing',
                });
                break;
              case 'SUCCESS':
                store.completeToolCall?.(toolCallId, result);
                this.updateApprovalStateInAssistant(requestId, approvalId, { status: 'executed' });
                break;
              case 'ERROR':
                store.failToolCall?.(toolCallId, error || 'Execution error');
                this.updateApprovalStateInAssistant(requestId, approvalId, {
                  status: 'failed',
                  error: error || 'Execution error',
                });
                break;
              case 'REJECTED':
                store.rejectToolCall?.(toolCallId, 'User rejected');
                this.updateApprovalStateInAssistant(requestId, approvalId, { status: 'denied' });
                break;
              case 'PENDING_APPROVAL':
                store.transitionRequest?.(requestId, 'WAITING_APPROVALS');
                break;
            }
          },
        ),
      );
    }

    if (window.ai.onStreamError) {
      this.registerRequestSubscription(
        requestId,
        window.ai.onStreamError(({ requestId: eventRequestId, error }: any) => {
          if (eventRequestId !== requestId) return;
          this.getStore().setRequestError?.(requestId, error || 'Stream error');
        }),
      );
    }

    this.registerRequestSubscription(
      requestId,
      window.ai.onStreamDone(async ({ requestId: eventRequestId }: any) => {
        if (eventRequestId !== requestId) return;

        const request = this.getStore().getRequest?.(requestId);
        const stillPending =
          request?.toolCallIds
            ?.map((id: string) => this.getStore().getToolCall?.(id))
            .some((toolCall: any) => toolCall?.state.type === 'PENDING_APPROVAL') ?? false;

        if (stillPending) {
          this.getStore().transitionRequest?.(requestId, 'WAITING_APPROVALS');
          await this.saveConversation(
            conversationId,
            this.getRequestContext(requestId)?.persistOptions,
          );
          return;
        }

        this.getStore().completeRequest?.(requestId);
        await this.saveConversation(
          conversationId,
          this.getRequestContext(requestId)?.persistOptions,
        );
        this.cleanupRequest(requestId);
      }),
    );
  }

  async handleApproveToolCall(
    requestId: string,
    toolCallId: string,
    conversationId: string,
  ): Promise<void> {
    const toolCall = this.getStore().getToolCall?.(toolCallId);
    if (!toolCall?.approvalId) {
      throw new Error(`Missing approvalId for tool call ${toolCallId}`);
    }

    await this.respondToToolApproval({
      conversationId,
      approvalId: toolCall.approvalId,
      approved: true,
      autoSave: this.getRequestContext(requestId)?.persistOptions.autoSave,
      source: this.getRequestContext(requestId)?.persistOptions.source,
      sourceEntityId: this.getRequestContext(requestId)?.persistOptions.sourceEntityId,
    });
  }

  async handleRejectToolCall(toolCallId: string, conversationId: string): Promise<void> {
    const toolCall = this.getStore().getToolCall?.(toolCallId);
    if (!toolCall?.approvalId) {
      throw new Error(`Missing approvalId for tool call ${toolCallId}`);
    }

    await this.respondToToolApproval({
      conversationId,
      approvalId: toolCall.approvalId,
      approved: false,
      autoSave: true,
    });
  }

  async respondToToolApproval(options: {
    conversationId: string;
    approvalId: string;
    approved: boolean;
    autoSave?: boolean;
    source?: AIConversationSource;
    sourceEntityId?: string | null;
  }): Promise<void> {
    const toolCall = this.findToolCallByApprovalId(options.approvalId);
    if (!toolCall) {
      throw new Error(`Unknown approvalId: ${options.approvalId}`);
    }

    const requestId = toolCall.requestId;

    if (options.approved) {
      // 主窗口可能因为事件广播缺失而收不到 EXECUTING 状态，这里先在本地推进状态机，
      // 避免工具已经执行成功但请求仍卡在待审批/加载中。
      this.getStore().approveToolCall?.(toolCall.id);
      this.getStore().transitionRequest?.(requestId, 'EXECUTING_TOOLS');
      this.updateApprovalStateInAssistant(requestId, options.approvalId, {
        status: 'processing',
      });
    }

    const result = await window.ai.respondToolApproval({
      approvalId: options.approvalId,
      approved: options.approved,
    });

    if (!result.success) {
      this.getStore().failToolCall?.(toolCall.id, result.error || 'Tool approval failed');
      this.updateApprovalStateInAssistant(requestId, options.approvalId, {
        status: 'failed',
        error: result.error || 'Tool approval failed',
      });
      await this.saveConversation(options.conversationId, options);
      throw new Error(result.error || 'Tool approval failed');
    }

    if (result.approval) {
      this.mergeApprovalIntoAssistant(requestId, result.approval);
      this.appendApprovalContinuation(requestId, result.approval, result.content);

      if (result.approval.status === 'executed') {
        this.getStore().completeToolCall?.(toolCall.id, result.content ?? null);
      }

      if (result.approval.status === 'denied') {
        this.getStore().rejectToolCall?.(toolCall.id, 'User rejected');
      }
    }

    for (const approval of result.followUpApprovals ?? []) {
      this.ensureToolCallForApproval(requestId, approval);
      this.mergeApprovalIntoAssistant(requestId, approval);
    }

    const request = this.getStore().getRequest?.(requestId);
    const stillPending =
      request?.toolCallIds
        ?.map((id: string) => this.getStore().getToolCall?.(id))
        .some((item: any) => item?.state.type === 'PENDING_APPROVAL') ?? false;

    if (stillPending) {
      this.getStore().transitionRequest?.(requestId, 'WAITING_APPROVALS');
    } else {
      this.getStore().completeRequest?.(requestId);
      this.cleanupRequest(requestId);
    }

    await this.saveConversation(options.conversationId, options);
  }

  private async saveConversation(
    conversationId: string,
    options: PersistOptions = {},
  ): Promise<void> {
    if (!options.autoSave) {
      return;
    }

    const messages = storeMessagesToPersistedMessages(this.getConversationMessages(conversationId));
    await window.storage.saveAIConversationMessages(conversationId, messages, {
      source: options.source,
      sourceEntityId: options.sourceEntityId ?? undefined,
    });
  }

  cleanup(): void {
    for (const requestId of this.requestSubscriptions.keys()) {
      this.cleanupRequest(requestId);
    }
  }
}
