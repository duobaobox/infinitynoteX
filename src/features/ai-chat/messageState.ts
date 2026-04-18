import type { AIRunTrace, AIToolApproval } from '../../services/types';
import type { AIToolDraft } from './types';
import type { XChatMessage } from './xsdk/IpcChatProvider';
import { mergeToolApprovals, mergeToolDrafts, removeToolDraft } from './approvalFlow';

export type ChatMessageInfo = {
  id: string | number;
  status: 'success' | 'loading' | 'updating' | 'error' | 'abort' | 'local';
  message: XChatMessage;
};

export function findLastAiMessageIndex(infos: ChatMessageInfo[]): number {
  for (let index = infos.length - 1; index >= 0; index -= 1) {
    if (infos[index]?.message.role === 'ai') {
      return index;
    }
  }

  return -1;
}

export function findMessageIndexByApprovalId(infos: ChatMessageInfo[], approvalId: string): number {
  return infos.findIndex((info) =>
    info.message.toolApprovals?.some((approval) => approval.approvalId === approvalId),
  );
}

export function findMessageIndexByRequestId(infos: ChatMessageInfo[], requestId: string): number {
  for (let index = infos.length - 1; index >= 0; index -= 1) {
    if (infos[index]?.message.runTrace?.requestId === requestId) {
      return index;
    }
  }

  return -1;
}

function findMessageIndexByApprovalTargets(
  infos: ChatMessageInfo[],
  approvals: AIToolApproval[],
): number {
  for (let index = infos.length - 1; index >= 0; index -= 1) {
    const existingApprovals = infos[index]?.message.toolApprovals;
    if (!existingApprovals?.length) {
      continue;
    }

    const matched = approvals.some((approval) =>
      existingApprovals.some(
        (existing) =>
          existing.approvalId === approval.approvalId ||
          existing.toolCallId === approval.toolCallId,
      ),
    );

    if (matched) {
      return index;
    }
  }

  return -1;
}

export function mergeApprovalsIntoInfos(
  infos: ChatMessageInfo[],
  approvals: AIToolApproval[],
  options?: { requestId?: string | null },
): ChatMessageInfo[] {
  if (approvals.length === 0) {
    return infos;
  }

  const nextInfos = [...infos];
  const explicitIndex = findMessageIndexByApprovalTargets(nextInfos, approvals);
  const requestIndex =
    explicitIndex < 0 && options?.requestId
      ? findMessageIndexByRequestId(nextInfos, options.requestId)
      : -1;
  const targetIndex =
    explicitIndex >= 0
      ? explicitIndex
      : requestIndex >= 0
        ? requestIndex
        : findLastAiMessageIndex(nextInfos);

  if (targetIndex >= 0) {
    const target = nextInfos[targetIndex];
    nextInfos[targetIndex] = {
      ...target,
      status: target.status === 'loading' ? 'success' : target.status,
      message: {
        ...target.message,
        toolApprovals: mergeToolApprovals(target.message.toolApprovals, approvals),
      },
    };
    return nextInfos;
  }

  nextInfos.push({
    id: `approval_${approvals[0].approvalId}`,
    status: 'success',
    message: {
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      toolApprovals: approvals,
    },
  });
  return nextInfos;
}

export function mergeToolDraftsIntoInfos(
  infos: ChatMessageInfo[],
  drafts: AIToolDraft[],
  options?: { requestId?: string | null },
): ChatMessageInfo[] {
  if (drafts.length === 0) {
    return infos;
  }

  const nextInfos = [...infos];
  const requestIndex = options?.requestId
    ? findMessageIndexByRequestId(nextInfos, options.requestId)
    : -1;
  const targetIndex = requestIndex >= 0 ? requestIndex : findLastAiMessageIndex(nextInfos);

  if (targetIndex >= 0) {
    const target = nextInfos[targetIndex];
    nextInfos[targetIndex] = {
      ...target,
      message: {
        ...target.message,
        toolDrafts: mergeToolDrafts(target.message.toolDrafts, drafts),
      },
    };
    return nextInfos;
  }

  nextInfos.push({
    id: `tool_draft_${drafts[0].toolCallId}`,
    status: 'loading',
    message: {
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      toolDrafts: drafts,
    },
  });
  return nextInfos;
}

export function removeToolDraftFromInfos(
  infos: ChatMessageInfo[],
  toolCallId: string,
): ChatMessageInfo[] {
  let changed = false;
  const nextInfos = infos.map((info) => {
    const nextDrafts = removeToolDraft(info.message.toolDrafts, toolCallId);
    if (nextDrafts === info.message.toolDrafts) {
      return info;
    }

    changed = true;
    return {
      ...info,
      message: {
        ...info.message,
        toolDrafts: nextDrafts,
      },
    };
  });

  return changed ? nextInfos : infos;
}

export function mergeRunTraceIntoInfos(
  infos: ChatMessageInfo[],
  runTrace: AIRunTrace,
  options?: { requestId?: string | null },
): ChatMessageInfo[] {
  const nextInfos = [...infos];
  const requestId = options?.requestId ?? runTrace.requestId;
  const requestIndex = requestId ? findMessageIndexByRequestId(nextInfos, requestId) : -1;
  const targetIndex = requestIndex >= 0 ? requestIndex : findLastAiMessageIndex(nextInfos);

  if (targetIndex >= 0) {
    const target = nextInfos[targetIndex];
    nextInfos[targetIndex] = {
      ...target,
      message: {
        ...target.message,
        runTrace,
      },
    };
    return nextInfos;
  }

  nextInfos.push({
    id: `run_${runTrace.runId}`,
    status: 'loading',
    message: {
      role: 'ai',
      content: '',
      timestamp: Date.now(),
      runTrace,
    },
  });

  return nextInfos;
}
