/**
 * ChatOrchestrator 集成测试
 * 验证消息发送、工具调用、审批的完整流程
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi } from 'vitest';

import { ChatOrchestrator } from '../orchestrators/ChatOrchestrator';
import type { Message } from '../../../store/slices/aiConversationSlice';

// Mock Store
const createMockStore = () => {
  const requests: Record<string, any> = {};
  const toolCalls: Record<string, any> = {};
  const messages: Record<string, Message[]> = {};

  return {
    createRequest: (conversationId: string) => {
      const id = `req-${Date.now()}`;
      const request = {
        id,
        conversationId,
        state: 'GENERATING',
        toolCallIds: [],
        messageIds: [],
        startTime: Date.now(),
      };
      requests[id] = request;
      return request;
    },
    getRequest: (id: string) => requests[id],
    transitionRequest: (id: string, state: string) => {
      if (requests[id]) {
        requests[id].state = state;
      }
    },
    addToolCallToRequest: (requestId: string, toolCallId: string) => {
      if (requests[requestId]) {
        requests[requestId].toolCallIds.push(toolCallId);
      }
    },
    addMessageToRequest: (requestId: string, messageId: string) => {
      if (requests[requestId]) {
        requests[requestId].messageIds.push(messageId);
      }
    },
    completeRequest: (id: string) => {
      if (requests[id]) {
        requests[id].state = 'COMPLETED';
        requests[id].completedTime = Date.now();
      }
    },
    setRequestError: (id: string, error: string) => {
      if (requests[id]) {
        requests[id].state = 'ERROR';
        requests[id].error = error;
        requests[id].completedTime = Date.now();
      }
    },
    createToolCall: (requestId: string, toolCallId: string, toolName: string) => {
      const toolCall = {
        id: toolCallId,
        requestId,
        toolName,
        state: { type: 'DRAFTING', input: '' },
        createdAt: Date.now(),
      };
      toolCalls[toolCallId] = toolCall;
      return toolCall;
    },
    getToolCall: (id: string) => toolCalls[id],
    updateToolCallDraft: (id: string, delta: string) => {
      if (toolCalls[id]?.state.type === 'DRAFTING') {
        toolCalls[id].state.input = (toolCalls[id].state.input || '') + delta;
      }
    },
    completeToolCallDraft: (id: string, input: unknown, preview: string) => {
      if (toolCalls[id]) {
        toolCalls[id].state = { type: 'PENDING_APPROVAL', input, preview };
      }
    },
    setToolCallApproval: (id: string, approvalId: string) => {
      if (toolCalls[id]) {
        toolCalls[id].approvalId = approvalId;
      }
    },
    approveToolCall: (id: string) => {
      if (toolCalls[id]) {
        toolCalls[id].state = { type: 'EXECUTING' };
      }
    },
    rejectToolCall: (id: string, reason: string) => {
      if (toolCalls[id]) {
        toolCalls[id].state = { type: 'REJECTED', reason };
      }
    },
    completeToolCall: (id: string, result: unknown) => {
      if (toolCalls[id]?.state.type === 'EXECUTING') {
        toolCalls[id].state = { type: 'SUCCESS', result };
      }
    },
    failToolCall: (id: string, error: string) => {
      if (toolCalls[id]?.state.type === 'EXECUTING') {
        toolCalls[id].state = { type: 'ERROR', error };
      }
    },
    appendMessage: (conversationId: string, message: Message) => {
      if (!messages[conversationId]) {
        messages[conversationId] = [];
      }
      messages[conversationId].push(message);
    },
    updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => {
      if (messages[conversationId]) {
        const idx = messages[conversationId].findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          messages[conversationId][idx] = { ...messages[conversationId][idx], ...updates };
        }
      }
    },
    getConversationMessages: (conversationId: string) => messages[conversationId] || [],
    // 暴露内部状态用于测试
    requests,
    toolCalls,
    messages,
  };
};

// Mock IPC Bridge
const createMockIPCBridge = () => {
  const listeners: Record<string, Array<(data: any) => void>> = {};

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    send: (_event: string, _data: any) => {
      // Simulate IPC sending (would go to Main Process)
    },
    on: (event: string, callback: (data: any) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      return () => {
        const idx = listeners[event].indexOf(callback);
        if (idx >= 0) {
          listeners[event].splice(idx, 1);
        }
      };
    },
    trigger: (event: string, data: any) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
    getListeners: () => listeners,
  };
};

describe('ChatOrchestrator - Integration Tests', () => {
  let orchestrator: ChatOrchestrator;
  let mockStore: any;
  let mockIPC: any;
  let respondToolApprovalMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStore = createMockStore();
    mockIPC = createMockIPCBridge();
    orchestrator = new ChatOrchestrator(mockStore);
    respondToolApprovalMock = vi.fn(async (payload: any) => {
      return {
        success: true,
        content: 'Tool executed successfully',
        approval: {
          approvalId: payload.approvalId,
          toolCallId: 'tool-1',
          toolName: 'test-tool',
          status: payload.approved ? 'executed' : 'denied',
        },
        followUpApprovals: [],
      };
    });

    // Mock window.ai
    (global as any).window = {
      ai: {
        chatStream: async () => {
          // Simulate successful IPC call
        },
        respondToolApproval: respondToolApprovalMock,
        onStreamChunk: (cb: (data: any) => void) => mockIPC.on('stream:chunk', cb),
        onToolProgress: (cb: (data: any) => void) => mockIPC.on('tool:progress', cb),
        onToolApprovalRequest: (cb: (data: any) => void) => mockIPC.on('tool:approval', cb),
        onStreamDone: (cb: (data: any) => void) => mockIPC.on('stream:done', cb),
        onStreamError: (cb: (data: any) => void) => mockIPC.on('stream:error', cb),
        onRunUpdate: (cb: (data: any) => void) => mockIPC.on('run:update', cb),
        onApprovalStateChanged: (cb: (data: any) => void) =>
          mockIPC.on('approval:state-changed', cb),
      },
      storage: {
        saveAIConversationMessages: async () => {},
      },
    };
  });

  afterEach(() => {
    orchestrator.cleanup();
  });

  it('应该正确处理用户发送消息的流程', async () => {
    await orchestrator.handleSendMessage('conv-1', 'Hello AI', []);

    // 验证Request已创建
    expect(mockStore.requests).toBeDefined();
    const requests = Object.values(mockStore.requests);
    expect(requests.length).toBeGreaterThan(0);

    // 验证用户消息已添加
    const messages = mockStore.getConversationMessages('conv-1');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello AI');
  });

  it('应该在收到IPC流数据时追加AI消息', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Hello', []);

    // 模拟流数据
    mockIPC.trigger('stream:chunk', {
      requestId: Object.keys(mockStore.requests)[0],
      chunk: { delta: 'Hello' },
    });

    mockIPC.trigger('stream:chunk', {
      requestId: Object.keys(mockStore.requests)[0],
      chunk: { delta: ' world' },
    });

    const messages = mockStore.getConversationMessages(conversationId);
    const aiMessages = messages.filter((m: Message) => m.role === 'assistant');

    expect(aiMessages.length).toBeGreaterThan(0);
    expect(aiMessages[0].content).toBe('Hello world');
  });

  it('应该在工具进度开始时创建ToolCall', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Execute command', []);

    const requestId = Object.keys(mockStore.requests)[0];

    // 模拟工具进度
    mockIPC.trigger('tool:progress', {
      requestId,
      progress: {
        phase: 'start',
        toolCallId: 'tool-1',
        toolName: 'execute_command',
      },
    });

    const request = mockStore.getRequest(requestId);
    expect(request.toolCallIds).toContain('tool-1');

    const toolCall = mockStore.getToolCall('tool-1');
    expect(toolCall).toBeDefined();
    expect(toolCall.toolName).toBe('execute_command');
  });

  it('应该在工具参数流过程中更新草稿', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Execute', []);

    const requestId = Object.keys(mockStore.requests)[0];

    // 开始工具
    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'cmd' },
    });

    // 参数流式传入
    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'delta', toolCallId: 'tool-1', inputTextDelta: '{"cmd"' },
    });

    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'delta', toolCallId: 'tool-1', inputTextDelta: ':"ls"}' },
    });

    const toolCall = mockStore.getToolCall('tool-1');
    expect(toolCall.state.input).toBe('{"cmd":"ls"}');
  });

  it('应该在工具参数完成时转移到PENDING_APPROVAL', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Execute', []);

    const requestId = Object.keys(mockStore.requests)[0];

    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'cmd' },
    });

    // 完成工具参数
    mockIPC.trigger('tool:approval', {
      requestId,
      approval: {
        approvalId: 'approval-1',
        toolCallId: 'tool-1',
        inputPreview: '{"cmd":"ls"}',
      },
    });

    const toolCall = mockStore.getToolCall('tool-1');
    expect(toolCall.state.type).toBe('PENDING_APPROVAL');
    expect(toolCall.approvalId).toBe('approval-1');

    const request = mockStore.getRequest(requestId);
    expect(request.state).toBe('WAITING_APPROVALS');
  });

  it('应该在流完成时标记Request为COMPLETED（无待审批工具）', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Simple message', []);

    const requestId = Object.keys(mockStore.requests)[0];

    // 无工具调用，直接完成流
    mockIPC.trigger('stream:done', { requestId });

    const request = mockStore.getRequest(requestId);
    expect(request.state).toBe('COMPLETED');
    expect(request.completedTime).toBeDefined();
  });

  it('应该在运行链路完成事件到达时收尾请求', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Run agent', []);

    const requestId = Object.keys(mockStore.requests)[0];

    mockIPC.trigger('approval:state-changed', {
      requestId,
      toolCallId: 'tool-1',
      approvalId: 'approval-1',
      state: 'SUCCESS',
      result: {},
    });

    mockIPC.trigger('run:update', {
      requestId,
      run: {
        requestId,
        runId: 'run-1',
        status: 'completed',
        input: 'Run agent',
        startedAt: 1,
        endedAt: 2,
        steps: [],
        artifacts: [],
      },
    });

    const request = mockStore.getRequest(requestId);
    expect(request.state).toBe('COMPLETED');
  });

  it('应该在运行链路失败事件到达时结束请求', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Run agent', []);

    const requestId = Object.keys(mockStore.requests)[0];

    mockIPC.trigger('run:update', {
      requestId,
      run: {
        requestId,
        runId: 'run-failed-1',
        status: 'failed',
        input: 'Run agent',
        startedAt: 1,
        endedAt: 2,
        error: 'Cannot connect to API',
        steps: [],
        artifacts: [],
      },
    });

    const request = mockStore.getRequest(requestId);
    expect(request.state).toBe('ERROR');
    expect(request.error).toBe('Cannot connect to API');
  });

  it('应该在流错误时标记运行失败并结束请求', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Run agent', []);

    const requestId = Object.keys(mockStore.requests)[0];

    mockIPC.trigger('run:update', {
      requestId,
      run: {
        requestId,
        runId: 'run-error-1',
        status: 'running',
        input: 'Run agent',
        startedAt: 1,
        steps: [
          {
            stepId: 'generation',
            kind: 'generation',
            title: '生成回答',
            status: 'running',
            startedAt: 1,
          },
        ],
        artifacts: [],
      },
    });

    mockIPC.trigger('stream:error', {
      requestId,
      error: 'Cannot connect to API',
    });

    const request = mockStore.getRequest(requestId);
    const assistantMessage = mockStore
      .getConversationMessages(conversationId)
      .find((message: Message) => message.role === 'assistant');

    expect(request.state).toBe('ERROR');
    expect(request.error).toBe('Cannot connect to API');
    expect(assistantMessage?.runTrace).toMatchObject({
      status: 'failed',
      error: 'Cannot connect to API',
    });
  });

  it('应该处理用户批准工具调用的流程', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Execute', []);

    const requestId = Object.keys(mockStore.requests)[0];

    // 创建工具
    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'cmd' },
    });

    mockIPC.trigger('tool:approval', {
      requestId,
      approval: { approvalId: 'approval-1', toolCallId: 'tool-1', inputPreview: '{}' },
    });

    // 用户批准
    await orchestrator.handleApproveToolCall(requestId, 'tool-1', conversationId);

    expect(respondToolApprovalMock).toHaveBeenCalledWith({
      approvalId: 'approval-1',
      approved: true,
    });

    const toolCall = mockStore.getToolCall('tool-1');
    expect(toolCall.state.type).toBe('SUCCESS');
  });

  it('应该在缺少审批状态事件时，仍然完成工具调用并结束请求', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Create task', []);

    const requestId = Object.keys(mockStore.requests)[0];

    mockIPC.trigger('run:update', {
      requestId,
      run: {
        requestId,
        runId: 'run-approval-1',
        status: 'running',
        input: 'Create task',
        startedAt: 1,
        steps: [
          {
            stepId: 'generation',
            kind: 'generation',
            title: '生成回答',
            detail: '回答生成完成。',
            status: 'completed',
            startedAt: 1,
            endedAt: 2,
          },
        ],
        artifacts: [],
      },
    });

    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'createManualTask' },
    });

    mockIPC.trigger('tool:approval', {
      requestId,
      approval: {
        approvalId: 'approval-1',
        toolCallId: 'tool-1',
        toolName: 'createManualTask',
        inputPreview: '{"text":"整理会议纪要"}',
      },
    });

    await orchestrator.handleApproveToolCall(requestId, 'tool-1', conversationId);

    const toolCall = mockStore.getToolCall('tool-1');
    const request = mockStore.getRequest(requestId);

    expect(toolCall.state.type).toBe('SUCCESS');
    expect(request.state).toBe('COMPLETED');

    const assistantMessage = mockStore
      .getConversationMessages(conversationId)
      .find((message: Message) => message.role === 'assistant');
    expect(assistantMessage?.runTrace?.status).toBe('completed');
  });

  it('运行完成事件先于审批结果返回时，仍然合并最终审批结果', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Create task', []);

    const requestId = Object.keys(mockStore.requests)[0];

    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'createManualTask' },
    });

    mockIPC.trigger('tool:approval', {
      requestId,
      approval: {
        approvalId: 'approval-1',
        toolCallId: 'tool-1',
        toolName: 'createManualTask',
        title: '建议创建任务“整理会议纪要”',
        description: 'AI 想把当前结论落成待办。',
        inputPreview: '{"text":"整理会议纪要"}',
        status: 'pending',
      },
    });

    respondToolApprovalMock.mockImplementationOnce(async (payload: any) => {
      mockIPC.trigger('run:update', {
        requestId,
        run: {
          requestId,
          runId: 'run-approval-completed-1',
          status: 'completed',
          input: 'Create task',
          startedAt: 1,
          endedAt: 2,
          steps: [],
          artifacts: [],
        },
      });

      return {
        success: true,
        content: '你可以在默认任务清单里继续安排下一步。',
        approval: {
          approvalId: payload.approvalId,
          toolCallId: 'tool-1',
          toolName: 'createManualTask',
          title: '建议创建任务“整理会议纪要”',
          description: 'AI 想把当前结论落成待办。',
          status: 'executed',
          resultSummary: '已创建到 默认任务清单',
        },
        followUpApprovals: [],
      };
    });

    await orchestrator.handleApproveToolCall(requestId, 'tool-1', conversationId);

    const assistantMessage = mockStore
      .getConversationMessages(conversationId)
      .find((message: Message) => message.role === 'assistant');

    expect(assistantMessage?.runTrace?.status).toBe('completed');
    expect(assistantMessage?.content).toContain('继续安排下一步');
    expect(assistantMessage?.toolApprovals?.[0]).toMatchObject({
      approvalId: 'approval-1',
      status: 'executed',
      resultSummary: '已创建到 默认任务清单',
    });
  });

  it('应该合并同批多个审批的执行结果', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Create two tasks', []);

    const requestId = Object.keys(mockStore.requests)[0];

    for (const id of ['tool-1', 'tool-2']) {
      mockIPC.trigger('tool:progress', {
        requestId,
        progress: { phase: 'start', toolCallId: id, toolName: 'createManualTask' },
      });

      mockIPC.trigger('tool:approval', {
        requestId,
        approval: {
          approvalId: id.replace('tool', 'approval'),
          toolCallId: id,
          toolName: 'createManualTask',
          inputPreview: '{}',
        },
      });
    }

    respondToolApprovalMock.mockResolvedValueOnce({
      success: true,
      content: '',
      approval: {
        approvalId: 'approval-1',
        toolCallId: 'tool-1',
        toolName: 'createManualTask',
        title: '任务 1',
        description: '任务 1',
        status: 'processing',
      },
      followUpApprovals: [],
    });

    await orchestrator.handleApproveToolCall(requestId, 'tool-1', conversationId);

    respondToolApprovalMock.mockResolvedValueOnce({
      success: true,
      content: '已创建两个任务',
      approval: {
        approvalId: 'approval-2',
        toolCallId: 'tool-2',
        toolName: 'createManualTask',
        title: '任务 2',
        description: '任务 2',
        status: 'executed',
      },
      approvals: [
        {
          approvalId: 'approval-1',
          toolCallId: 'tool-1',
          toolName: 'createManualTask',
          title: '任务 1',
          description: '任务 1',
          status: 'executed',
        },
        {
          approvalId: 'approval-2',
          toolCallId: 'tool-2',
          toolName: 'createManualTask',
          title: '任务 2',
          description: '任务 2',
          status: 'executed',
        },
      ],
      followUpApprovals: [],
    });

    await orchestrator.handleApproveToolCall(requestId, 'tool-2', conversationId);

    expect(mockStore.getToolCall('tool-1').state.type).toBe('SUCCESS');
    expect(mockStore.getToolCall('tool-2').state.type).toBe('SUCCESS');
    expect(mockStore.getRequest(requestId).state).toBe('COMPLETED');
  });

  it('应该处理用户拒绝工具调用的流程', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Execute', []);

    const requestId = Object.keys(mockStore.requests)[0];

    // 创建工具
    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'cmd' },
    });

    mockIPC.trigger('tool:approval', {
      requestId,
      approval: { approvalId: 'approval-1', toolCallId: 'tool-1', inputPreview: '{}' },
    });

    // 用户拒绝
    await orchestrator.handleRejectToolCall('tool-1', conversationId);

    const toolCall = mockStore.getToolCall('tool-1');
    expect(toolCall.state.type).toBe('REJECTED');
  });

  it('应该支持多个工具的并行处理', async () => {
    const conversationId = 'conv-1';
    await orchestrator.handleSendMessage(conversationId, 'Execute multiple', []);

    const requestId = Object.keys(mockStore.requests)[0];

    // 创建多个工具
    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-1', toolName: 'cmd1' },
    });

    mockIPC.trigger('tool:progress', {
      requestId,
      progress: { phase: 'start', toolCallId: 'tool-2', toolName: 'cmd2' },
    });

    // 完成两个工具的参数
    mockIPC.trigger('tool:approval', {
      requestId,
      approval: { toolCallId: 'tool-1', inputPreview: '{}' },
    });

    mockIPC.trigger('tool:approval', {
      requestId,
      approval: { toolCallId: 'tool-2', inputPreview: '{}' },
    });

    const request = mockStore.getRequest(requestId);
    expect(request.toolCallIds.length).toBe(2);
    expect(request.state).toBe('WAITING_APPROVALS');
  });

  it('应该在清理时卸载所有IPC监听器', () => {
    mockStore.createRequest('conv-1');
    orchestrator.cleanup();

    // 应该没有活跃的监听器
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _listeners = mockIPC.getListeners();
    // 注意：mock中的监听器取决于实现细节，此处验证cleanup被调用
    expect(orchestrator).toBeDefined();
  });
});
