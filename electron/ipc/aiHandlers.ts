/**
 * AI IPC Handlers
 * AI 相关 IPC 处理器 - 从 main.ts 抽离
 */

import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { ModelMessage } from 'ai';
import type { AIConfig, ChatPayload } from '../../src/services/aiConfig';
import type { AIToolApproval } from '../../src/services/types';
import { getProviderCapabilities } from '../../src/services/aiProviders';
import { IPC_CHANNELS, getIpcProxyChannel } from '../../src/shared/types/ipc';
import type { IpcProxyMethod } from '../../src/shared/types/ipc';
import { readAIConfig, readActiveAIProviderConfig, writeAIConfig, createAdapter } from '../ai';
import { orchestrateRetrieval } from '../ai/retrievalOrchestrator';
import { AIRunTracker } from '../ai/runTrace';
import {
  buildToolApprovalRequest,
  buildToolExecutionSummary,
  isApprovalRequiredTool,
} from '../ai/toolRegistry';
import {
  consumePendingToolApprovals,
  getPendingToolApprovalsByIds,
  recordPendingToolApprovalDecision,
  registerPendingToolApproval,
  type PendingToolApprovalEntry,
} from '../ai/toolApprovalManager';
import { buildApprovalContinuationMessages } from '../ai/toolApprovalContinuation';
import { toolApprovalStateManager } from '../ai/toolApprovalStateManager';

const aiChannel = (method: IpcProxyMethod<'ai'>) => getIpcProxyChannel('ai', method);

// 流式请求中止控制器
const aiStreamAbortControllers = new Map<string, AbortController>();
const aiRunTrackers = new Map<string, AIRunTracker>();

function buildRequestScopeKey(senderId: number, requestId: string): string {
  return `${senderId}:${requestId}`;
}

function emitRunUpdate(args: {
  sender: WebContents;
  requestId: string;
  tracker: AIRunTracker;
}): void {
  args.sender.send(IPC_CHANNELS.aiRunUpdate, {
    requestId: args.requestId,
    run: args.tracker.snapshot(),
  });
}

function closeRunTrackerIfDone(runKey: string, tracker: AIRunTracker): void {
  const snapshot = tracker.snapshot();
  if (
    snapshot.status === 'completed' ||
    snapshot.status === 'failed' ||
    snapshot.status === 'cancelled'
  ) {
    aiRunTrackers.delete(runKey);
  }
}

async function resolvePayloadWithRetrieval(args: {
  payload: ChatPayload;
  config: AIConfig;
  tracker?: AIRunTracker;
  sender?: WebContents;
  requestId?: string;
}): Promise<ChatPayload> {
  const capabilities = getProviderCapabilities(args.config);

  if (args.tracker && args.sender && args.requestId) {
    args.tracker.upsertStep({
      stepId: 'planning',
      kind: 'planning',
      title: '分析请求并规划执行',
      status: 'running',
      detail: '正在评估工具与检索策略。',
    });
    args.tracker.upsertStep({
      stepId: 'retrieval',
      kind: 'retrieval',
      title: '准备检索上下文',
      status: 'running',
      detail: '正在构建检索查询。',
    });
    emitRunUpdate({
      sender: args.sender,
      requestId: args.requestId,
      tracker: args.tracker,
    });
  }

  const retrieval = await orchestrateRetrieval({
    message: args.payload.message,
    allowActiveRetrieval: args.payload.allowActiveRetrieval ?? false,
    supportsToolCalling: capabilities.toolCalling,
    existingRagContext: args.payload.ragContext,
  });

  if (args.tracker && args.sender && args.requestId) {
    args.tracker.upsertStep({
      stepId: 'planning',
      kind: 'planning',
      title: '分析请求并规划执行',
      status: 'completed',
      detail: `工具调用${capabilities.toolCalling ? '可用' : '不可用'}，检索策略：${retrieval.strategy}`,
    });

    const retrievalStepStatus =
      retrieval.strategy === 'disabled' || retrieval.strategy === 'tool-only'
        ? 'skipped'
        : 'completed';

    args.tracker.upsertStep({
      stepId: 'retrieval',
      kind: 'retrieval',
      title: '准备检索上下文',
      status: retrievalStepStatus,
      detail: retrieval.summary,
    });

    for (const artifact of retrieval.artifacts) {
      const appended = args.tracker.appendArtifact(artifact);
      args.tracker.attachArtifactToStep('retrieval', appended);
    }

    emitRunUpdate({
      sender: args.sender,
      requestId: args.requestId,
      tracker: args.tracker,
    });
  }

  return {
    ...args.payload,
    ragContext: retrieval.ragContext,
  };
}

function findFollowUpApprovals(
  responseMessages: ModelMessage[],
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>,
): Array<{
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}> {
  const toolCallMap = new Map(
    toolCalls.map((toolCall) => [toolCall.toolCallId, toolCall] as const),
  );

  const approvals: Array<{
    approvalId: string;
    toolCallId: string;
    toolName: string;
    input: unknown;
  }> = [];

  for (const message of responseMessages) {
    if (message.role !== 'assistant' || typeof message.content === 'string') {
      continue;
    }

    for (const part of message.content) {
      if (part.type !== 'tool-approval-request') {
        continue;
      }

      const toolCall = toolCallMap.get(part.toolCallId);
      if (!toolCall || !isApprovalRequiredTool(toolCall.toolName)) {
        continue;
      }

      approvals.push({
        approvalId: part.approvalId,
        toolCallId: part.toolCallId,
        toolName: toolCall.toolName,
        input: toolCall.input,
      });
    }
  }

  return approvals;
}

interface ToolResultPayload {
  toolCallId: string;
  toolName?: string;
  output?: unknown;
  type?: string;
}

function isToolResultPayload(value: unknown): value is ToolResultPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toolCallId' in value &&
    typeof value.toolCallId === 'string'
  );
}

function buildApprovalResultUpdate(args: {
  entry: PendingToolApprovalEntry;
  toolResult?: ToolResultPayload;
}): AIToolApproval {
  const approved = args.entry.decision?.approved ?? false;
  const executionSummary =
    approved && args.toolResult?.output
      ? buildToolExecutionSummary(args.entry.approval.toolName, args.toolResult.output)
      : approved
        ? '已批准执行'
        : '已拒绝执行';

  return {
    ...args.entry.approval,
    status: approved ? 'executed' : 'denied',
    resultSummary: executionSummary,
  };
}

/**
 * 注册 AI 相关 IPC 处理器
 */
export function registerAIHandlers(): void {
  ipcMain.handle(aiChannel('getConfig'), async () => {
    const config = await readAIConfig();
    return config;
  });

  ipcMain.handle(aiChannel('setConfig'), async (_, config: AIConfig) => {
    await writeAIConfig(config);
  });

  ipcMain.handle(aiChannel('testConnection'), async () => {
    try {
      const config = await readActiveAIProviderConfig();
      if (!config) {
        return { ok: false, message: '未找到 AI 配置，请先设置' };
      }
      const adapter = createAdapter(config);
      return await adapter.testConnection();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `连接测试失败：${msg}` };
    }
  });

  ipcMain.handle(aiChannel('chat'), async (_, payload: ChatPayload) => {
    try {
      const config = await readActiveAIProviderConfig();
      if (!config) {
        throw new Error('未找到 AI 配置，请先在设置中配置 AI');
      }
      const adapter = createAdapter(config);
      const runtimePayload = await resolvePayloadWithRetrieval({
        payload,
        config,
      });
      const response = await adapter.chat(runtimePayload);
      return { success: true, content: response.content };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(aiChannel('chatStream'), async (event, payload: ChatPayload) => {
    let currentRequestId: string | null = payload.requestId ?? null;
    let currentScopeKey: string | null = currentRequestId
      ? buildRequestScopeKey(event.sender.id, currentRequestId)
      : null;

    try {
      const config = await readActiveAIProviderConfig();
      if (!config) {
        throw new Error('未找到 AI 配置，请先在设置中配置 AI');
      }
      const adapter = createAdapter(config);

      const wcId = event.sender.id;
      const requestId = payload.requestId || `${wcId}-${Date.now()}`;
      const scopeKey = buildRequestScopeKey(wcId, requestId);
      currentRequestId = requestId;
      currentScopeKey = scopeKey;
      const controllerKey = scopeKey;
      const abortController = new AbortController();
      aiStreamAbortControllers.set(controllerKey, abortController);

      const runTracker = new AIRunTracker({
        requestId,
        input: payload.message,
      });
      aiRunTrackers.set(scopeKey, runTracker);
      emitRunUpdate({
        sender: event.sender,
        requestId,
        tracker: runTracker,
      });

      const runtimePayload = await resolvePayloadWithRetrieval({
        payload,
        config,
        tracker: runTracker,
        sender: event.sender,
        requestId,
      });

      const unsupportedToolActionMessage = adapter.getUnsupportedToolActionMessage(runtimePayload);
      if (unsupportedToolActionMessage) {
        runTracker.upsertStep({
          stepId: 'generation',
          kind: 'generation',
          title: '生成回答',
          status: 'skipped',
          detail: unsupportedToolActionMessage,
        });
        runTracker.setStatus('completed');
        emitRunUpdate({
          sender: event.sender,
          requestId,
          tracker: runTracker,
        });

        event.sender.send(IPC_CHANNELS.aiStreamChunk, {
          requestId,
          chunk: {
            delta: unsupportedToolActionMessage,
            finishReason: 'stop',
          },
        });
        event.sender.send(IPC_CHANNELS.aiStreamDone, { requestId, success: true });
        aiStreamAbortControllers.delete(controllerKey);
        aiRunTrackers.delete(scopeKey);
        return { success: true, requestId };
      }

      const modelMessages = adapter.buildRequestMessages(runtimePayload);
      runTracker.upsertStep({
        stepId: 'generation',
        kind: 'generation',
        title: '生成回答',
        status: 'running',
        detail: '正在生成回答。',
      });
      emitRunUpdate({
        sender: event.sender,
        requestId,
        tracker: runTracker,
      });

      (async () => {
        try {
          const streamResult = adapter.createStreamResult(runtimePayload, abortController.signal);
          const responseMessagesPromise = Promise.resolve(streamResult.response).then(
            (response) => response.messages as ModelMessage[],
          );
          const pendingToolCalls = new Map<string, { toolName: string; input: unknown }>();
          const pendingToolInputs = new Map<string, { toolName: string; title?: string }>();
          let hasPendingApprovals = false;

          for await (const part of streamResult.fullStream) {
            switch (part.type) {
              case 'reasoning-delta':
                event.sender.send(IPC_CHANNELS.aiStreamChunk, {
                  requestId,
                  chunk: {
                    delta: '',
                    reasoningDelta: part.text,
                  },
                });
                break;
              case 'text-delta':
                event.sender.send(IPC_CHANNELS.aiStreamChunk, {
                  requestId,
                  chunk: {
                    delta: part.text,
                  },
                });
                break;
              case 'tool-call':
                if (isApprovalRequiredTool(part.toolName)) {
                  pendingToolCalls.set(part.toolCallId, {
                    toolName: part.toolName,
                    input: part.input,
                  });
                }
                break;
              case 'tool-input-start': {
                if (!isApprovalRequiredTool(part.toolName)) {
                  break;
                }

                runTracker.upsertStep({
                  stepId: `tool:${part.id}`,
                  kind: 'tool',
                  title: `准备工具 ${part.toolName}`,
                  status: 'running',
                  detail: part.title || '正在整理工具输入。',
                  toolName: part.toolName,
                });
                const inputArtifact = runTracker.appendArtifact({
                  type: 'tool-input',
                  title: `工具输入草稿（${part.toolName}）`,
                  summary: part.title || '工具参数草稿',
                  data: {
                    toolCallId: part.id,
                    toolName: part.toolName,
                  },
                });
                runTracker.attachArtifactToStep(`tool:${part.id}`, inputArtifact);
                emitRunUpdate({
                  sender: event.sender,
                  requestId,
                  tracker: runTracker,
                });

                pendingToolInputs.set(part.id, {
                  toolName: part.toolName,
                  title: part.title,
                });
                event.sender.send(IPC_CHANNELS.aiToolProgress, {
                  requestId,
                  progress: {
                    phase: 'start',
                    toolCallId: part.id,
                    toolName: part.toolName,
                    title: part.title,
                  },
                });
                break;
              }
              case 'tool-input-delta': {
                const draft = pendingToolInputs.get(part.id);
                if (!draft) {
                  break;
                }

                event.sender.send(IPC_CHANNELS.aiToolProgress, {
                  requestId,
                  progress: {
                    phase: 'delta',
                    toolCallId: part.id,
                    toolName: draft.toolName,
                    title: draft.title,
                    inputTextDelta: part.delta,
                  },
                });
                break;
              }
              case 'tool-approval-request': {
                const toolCall = pendingToolCalls.get(part.toolCall.toolCallId);
                if (!toolCall) {
                  break;
                }

                let approval: AIToolApproval | null = null;
                try {
                  approval = await buildToolApprovalRequest({
                    approvalId: part.approvalId,
                    toolCallId: part.toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                  });
                } catch (approvalError) {
                  console.error('[AI] Failed to build tool approval request:', approvalError);
                }

                if (!approval) {
                  break;
                }

                registerPendingToolApproval({
                  requestId,
                  runKey: scopeKey,
                  approval,
                  config,
                  allowActiveRetrieval: runtimePayload.allowActiveRetrieval ?? false,
                  baseMessages: modelMessages,
                  responseMessagesPromise,
                  createdAt: Date.now(),
                });

                // NEW: 推送工具审批请求状态到Renderer
                toolApprovalStateManager.notifyToolApprovalRequested({
                  requestId,
                  approvalId: part.approvalId,
                  toolCallId: part.toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  inputPreview: approval.preview ?? 'Tool input preview',
                  timestamp: Date.now(),
                });

                hasPendingApprovals = true;
                runTracker.upsertStep({
                  stepId: `tool:${part.toolCall.toolCallId}`,
                  kind: 'tool',
                  title: `准备工具 ${toolCall.toolName}`,
                  status: 'completed',
                  detail: '工具参数已准备完成。',
                  toolName: toolCall.toolName,
                });
                runTracker.upsertStep({
                  stepId: `approval:${part.approvalId}`,
                  kind: 'approval',
                  title: approval.title,
                  status: 'waiting',
                  detail: '等待用户审批。',
                  toolName: approval.toolName,
                  approvalId: part.approvalId,
                });
                runTracker.setStatus('waiting_approval');
                emitRunUpdate({
                  sender: event.sender,
                  requestId,
                  tracker: runTracker,
                });

                event.sender.send(IPC_CHANNELS.aiToolApprovalRequested, {
                  requestId,
                  approval,
                });
                pendingToolInputs.delete(part.toolCall.toolCallId);
                break;
              }
              case 'finish':
                event.sender.send(IPC_CHANNELS.aiStreamChunk, {
                  requestId,
                  chunk: {
                    delta: '',
                    finishReason: part.finishReason,
                  },
                });
                break;
              default:
                break;
            }
          }

          runTracker.upsertStep({
            stepId: 'generation',
            kind: 'generation',
            title: '生成回答',
            status: 'completed',
            detail: '回答生成完成。',
          });

          if (hasPendingApprovals || runTracker.hasWaitingApprovals()) {
            runTracker.setStatus('waiting_approval');
          } else {
            const answerArtifact = runTracker.appendArtifact({
              type: 'answer',
              title: '回答输出',
              summary: '模型完成本轮回答。',
            });
            runTracker.attachArtifactToStep('generation', answerArtifact);
            runTracker.setStatus('completed');
          }

          emitRunUpdate({
            sender: event.sender,
            requestId,
            tracker: runTracker,
          });
          closeRunTrackerIfDone(scopeKey, runTracker);
          event.sender.send(IPC_CHANNELS.aiStreamDone, { requestId, success: true });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const isAbort = /abort/i.test(msg);
          runTracker.upsertStep({
            stepId: 'generation',
            kind: 'generation',
            title: '生成回答',
            status: isAbort ? 'skipped' : 'failed',
            detail: msg,
          });
          runTracker.setStatus(isAbort ? 'cancelled' : 'failed', msg);
          emitRunUpdate({
            sender: event.sender,
            requestId,
            tracker: runTracker,
          });
          closeRunTrackerIfDone(scopeKey, runTracker);
          event.sender.send(IPC_CHANNELS.aiStreamError, { requestId, error: msg });
        } finally {
          const current = aiStreamAbortControllers.get(controllerKey);
          if (current === abortController) {
            aiStreamAbortControllers.delete(controllerKey);
          }
        }
      })();

      return { success: true, requestId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (currentScopeKey && currentRequestId) {
        const runTracker = aiRunTrackers.get(currentScopeKey);
        if (runTracker) {
          runTracker.upsertStep({
            stepId: 'generation',
            kind: 'generation',
            title: '生成回答',
            status: 'failed',
            detail: msg,
          });
          runTracker.setStatus('failed', msg);
          emitRunUpdate({
            sender: event.sender,
            requestId: currentRequestId,
            tracker: runTracker,
          });
          closeRunTrackerIfDone(currentScopeKey, runTracker);
        }
      }

      return { success: false, error: msg };
    }
  });

  ipcMain.handle(
    aiChannel('respondToolApproval'),
    async (
      event,
      payload: {
        approvalId: string;
        approved: boolean;
        reason?: string;
      },
    ) => {
      const pendingApproval = recordPendingToolApprovalDecision(payload.approvalId, {
        approved: payload.approved,
        ...(payload.reason ? { reason: payload.reason } : {}),
      });

      if (!pendingApproval) {
        return {
          success: false,
          error: '审批请求不存在或已过期，请重新发起一次 AI 请求。',
        };
      }

      const runKey =
        pendingApproval.runKey || buildRequestScopeKey(event.sender.id, pendingApproval.requestId);
      const runTracker = aiRunTrackers.get(runKey);

      if (runTracker) {
        runTracker.upsertStep({
          stepId: `approval:${payload.approvalId}`,
          kind: 'approval',
          title: pendingApproval.approval.title,
          status: 'running',
          detail: payload.approved ? '用户已批准，正在执行工具。' : '用户拒绝执行。',
          toolName: pendingApproval.approval.toolName,
          approvalId: payload.approvalId,
        });
        runTracker.setStatus(payload.approved ? 'running' : 'waiting_approval');
        emitRunUpdate({
          sender: event.sender,
          requestId: pendingApproval.requestId,
          tracker: runTracker,
        });
      }

      if (!payload.approved) {
        toolApprovalStateManager.notifyToolRejected({
          requestId: pendingApproval.requestId,
          approvalId: payload.approvalId,
          toolCallId: pendingApproval.approval.toolCallId,
          timestamp: Date.now(),
        });
      }

      let executionEntries: PendingToolApprovalEntry[] = [pendingApproval];

      try {
        const adapter = createAdapter(pendingApproval.config);
        const responseMessages = await pendingApproval.responseMessagesPromise;
        const approvalIdsInResponse = buildApprovalContinuationMessages({
          baseMessages: pendingApproval.baseMessages,
          responseMessages,
          decisions: [],
        }).approvalIds;
        const groupEntries = getPendingToolApprovalsByIds(approvalIdsInResponse);
        const groupEntryIds = new Set(groupEntries.map((entry) => entry.approval.approvalId));
        const missingEntries = approvalIdsInResponse.filter(
          (approvalId) => !groupEntryIds.has(approvalId),
        );

        if (missingEntries.length > 0) {
          throw new Error(`部分审批请求已过期，请重新发起一次 AI 请求。`);
        }

        const continuationPlan = buildApprovalContinuationMessages({
          baseMessages: pendingApproval.baseMessages,
          responseMessages,
          decisions: groupEntries
            .filter((entry) => entry.decision)
            .map((entry) => ({
              approvalId: entry.approval.approvalId,
              approved: entry.decision?.approved ?? false,
              ...(entry.decision?.reason ? { reason: entry.decision.reason } : {}),
            })),
        });

        if (!continuationPlan.ready) {
          const waitingApproval: AIToolApproval = {
            ...pendingApproval.approval,
            status: payload.approved ? 'processing' : 'denied',
            ...(payload.approved ? {} : { resultSummary: '已拒绝执行' }),
          };

          if (runTracker) {
            runTracker.upsertStep({
              stepId: `approval:${payload.approvalId}`,
              kind: 'approval',
              title: pendingApproval.approval.title,
              status: payload.approved ? 'waiting' : 'completed',
              detail: payload.approved ? '用户已批准，等待同批其他工具审批。' : '用户拒绝执行。',
              toolName: pendingApproval.approval.toolName,
              approvalId: payload.approvalId,
            });
            runTracker.setStatus('waiting_approval');
            emitRunUpdate({
              sender: event.sender,
              requestId: pendingApproval.requestId,
              tracker: runTracker,
            });
          }

          return {
            success: true,
            content: '',
            approval: waitingApproval,
            followUpApprovals: [],
          };
        }

        executionEntries = consumePendingToolApprovals(continuationPlan.approvalIds);

        for (const entry of executionEntries) {
          if (!entry.decision?.approved) {
            continue;
          }

          toolApprovalStateManager.notifyToolExecutionStarted({
            requestId: entry.requestId,
            approvalId: entry.approval.approvalId,
            toolCallId: entry.approval.toolCallId,
            timestamp: Date.now(),
          });
        }

        const result = await adapter.continueWithMessages(continuationPlan.messages, {
          allowActiveRetrieval: pendingApproval.allowActiveRetrieval,
        });
        const toolResultByCallId = new Map<string, ToolResultPayload>();
        for (const toolResult of result.toolResults) {
          if (isToolResultPayload(toolResult)) {
            toolResultByCallId.set(toolResult.toolCallId, toolResult);
          }
        }

        const completedApprovals = executionEntries.map((entry) =>
          buildApprovalResultUpdate({
            entry,
            toolResult: toolResultByCallId.get(entry.approval.toolCallId),
          }),
        );
        const currentApproval =
          completedApprovals.find((approval) => approval.approvalId === payload.approvalId) ??
          buildApprovalResultUpdate({ entry: pendingApproval });

        for (const entry of executionEntries) {
          if (!entry.decision?.approved) {
            continue;
          }

          toolApprovalStateManager.notifyToolExecutionSuccess({
            requestId: entry.requestId,
            approvalId: entry.approval.approvalId,
            toolCallId: entry.approval.toolCallId,
            result: toolResultByCallId.get(entry.approval.toolCallId)?.output ?? null,
            timestamp: Date.now(),
          });
        }

        const followUpApprovals = await Promise.all(
          findFollowUpApprovals(result.responseMessages, result.toolCalls).map(
            async (approvalCandidate) => {
              let approval: AIToolApproval | null = null;
              try {
                approval = await buildToolApprovalRequest(approvalCandidate);
              } catch (approvalError) {
                console.error(
                  '[AI] Failed to build follow-up tool approval request:',
                  approvalError,
                );
              }
              if (!approval) {
                return null;
              }

              registerPendingToolApproval({
                requestId: pendingApproval.requestId,
                runKey,
                approval,
                config: pendingApproval.config,
                allowActiveRetrieval: pendingApproval.allowActiveRetrieval,
                baseMessages: continuationPlan.messages,
                responseMessagesPromise: Promise.resolve(result.responseMessages),
                createdAt: Date.now(),
              });

              // NEW: 推送后续工具审批请求状态到Renderer
              toolApprovalStateManager.notifyToolApprovalRequested({
                requestId: pendingApproval.requestId,
                approvalId: approval.approvalId,
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
                inputPreview: approval.preview ?? 'Tool input preview',
                timestamp: Date.now(),
              });

              return approval;
            },
          ),
        );

        if (runTracker) {
          for (const entry of executionEntries) {
            const matchingToolResult = toolResultByCallId.get(entry.approval.toolCallId);
            const completedApproval = completedApprovals.find(
              (approval) => approval.approvalId === entry.approval.approvalId,
            );
            const executionSummary = completedApproval?.resultSummary;

            runTracker.upsertStep({
              stepId: `approval:${entry.approval.approvalId}`,
              kind: 'approval',
              title: entry.approval.title,
              status: 'completed',
              detail: executionSummary,
              toolName: entry.approval.toolName,
              approvalId: entry.approval.approvalId,
            });

            if (!entry.decision?.approved) {
              continue;
            }

            runTracker.upsertStep({
              stepId: `tool-result:${entry.approval.toolCallId}`,
              kind: 'tool',
              title: `执行工具 ${entry.approval.toolName}`,
              status: 'completed',
              detail: executionSummary,
              toolName: entry.approval.toolName,
            });

            if (matchingToolResult?.output) {
              const artifact = runTracker.appendArtifact({
                type: 'tool-result',
                title: `工具结果（${entry.approval.toolName}）`,
                summary: executionSummary,
                data: matchingToolResult.output,
              });
              runTracker.attachArtifactToStep(`tool-result:${entry.approval.toolCallId}`, artifact);
            }
          }

          const nextApprovals = followUpApprovals.filter(
            (approval): approval is AIToolApproval => approval !== null,
          );

          for (const approval of nextApprovals) {
            runTracker.upsertStep({
              stepId: `approval:${approval.approvalId}`,
              kind: 'approval',
              title: approval.title,
              status: 'waiting',
              detail: '等待用户审批。',
              toolName: approval.toolName,
              approvalId: approval.approvalId,
            });
          }

          if (nextApprovals.length > 0) {
            runTracker.setStatus('waiting_approval');
          } else {
            runTracker.setStatus('completed');
          }

          emitRunUpdate({
            sender: event.sender,
            requestId: pendingApproval.requestId,
            tracker: runTracker,
          });
          closeRunTrackerIfDone(runKey, runTracker);
        }

        return {
          success: true,
          content: result.content,
          approval: currentApproval,
          approvals: completedApprovals,
          followUpApprovals: followUpApprovals.filter(
            (approval): approval is AIToolApproval => approval !== null,
          ),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        for (const entry of executionEntries) {
          if (!entry.decision?.approved) {
            continue;
          }

          toolApprovalStateManager.notifyToolExecutionError({
            requestId: entry.requestId,
            approvalId: entry.approval.approvalId,
            toolCallId: entry.approval.toolCallId,
            error: msg,
            timestamp: Date.now(),
          });
        }

        if (runTracker) {
          runTracker.upsertStep({
            stepId: `approval:${payload.approvalId}`,
            kind: 'approval',
            title: pendingApproval.approval.title,
            status: 'failed',
            detail: msg,
            toolName: pendingApproval.approval.toolName,
            approvalId: payload.approvalId,
          });
          runTracker.setStatus('failed', msg);
          emitRunUpdate({
            sender: event.sender,
            requestId: pendingApproval.requestId,
            tracker: runTracker,
          });
          closeRunTrackerIfDone(runKey, runTracker);
        }

        return {
          success: false,
          approval: {
            ...pendingApproval.approval,
            status: 'failed' as const,
            error: msg,
          },
          error: msg,
        };
      }
    },
  );

  ipcMain.handle(aiChannel('abortStream'), (event, requestId?: string) => {
    if (!requestId) {
      return { success: false, error: 'missing requestId' };
    }

    const controllerKey = buildRequestScopeKey(event.sender.id, requestId);
    const controller = aiStreamAbortControllers.get(controllerKey);
    if (!controller) {
      return { success: false, error: 'no in-flight stream' };
    }

    const runTracker = aiRunTrackers.get(controllerKey);
    if (runTracker) {
      runTracker.upsertStep({
        stepId: 'generation',
        kind: 'generation',
        title: '生成回答',
        status: 'skipped',
        detail: '用户主动中止本次执行。',
      });
      runTracker.setStatus('cancelled');
      emitRunUpdate({
        sender: event.sender,
        requestId,
        tracker: runTracker,
      });
      closeRunTrackerIfDone(controllerKey, runTracker);
    }

    controller.abort();
    aiStreamAbortControllers.delete(controllerKey);
    return { success: true };
  });
}
