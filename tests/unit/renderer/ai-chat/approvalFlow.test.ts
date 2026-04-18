import { describe, expect, it } from 'vitest';

import {
  getToolDraftDisplay,
  isApprovalPlaceholderContent,
  mergeToolDrafts,
  removeToolDraft,
  resolveApprovalContinuationContent,
} from '../../../../src/features/ai-chat/approvalFlow';
import type { AIToolApproval } from '../../../../src/services/types';
import type { AIToolDraft } from '../../../../src/features/ai-chat/types';

const executedApproval: AIToolApproval = {
  approvalId: 'approval_1',
  toolCallId: 'tool_1',
  toolName: 'saveToNote',
  title: '建议新建便签《产品规划》',
  description: 'AI 想把当前结论沉淀成一条新的便签。',
  status: 'executed',
  resultSummary: '已新建便签《产品规划》',
};

describe('approvalFlow', () => {
  it('merges and removes tool drafts by toolCallId', () => {
    const draftA: AIToolDraft = {
      toolCallId: 'tool-1',
      toolName: 'saveToNote',
      inputText: '{"title":"A"}',
    };
    const draftB: AIToolDraft = {
      toolCallId: 'tool-2',
      toolName: 'createManualTask',
      inputText: '{"text":"B"}',
    };

    const merged = mergeToolDrafts([draftA], [{ ...draftA, inputText: '{"title":"A1"}' }, draftB]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.inputText).toBe('{"title":"A1"}');

    expect(removeToolDraft(merged, 'tool-1')).toEqual([draftB]);
  });

  it('returns canonical display copy for approval-required tool drafts', () => {
    expect(
      getToolDraftDisplay({
        toolCallId: 'tool-1',
        toolName: 'saveToNote',
        inputText: '',
      }).title,
    ).toBe('正在准备新建便签');
  });

  it('treats fallback approval titles as placeholder content', () => {
    expect(isApprovalPlaceholderContent('建议新建便签《产品规划》', [executedApproval])).toBe(true);
    expect(isApprovalPlaceholderContent('真正的回答正文', [executedApproval])).toBe(false);
  });

  it('suppresses short action-only follow-up replies after execution', () => {
    const content = resolveApprovalContinuationContent({
      currentContent: '建议新建便签《产品规划》',
      existingApprovals: [executedApproval],
      latestApproval: executedApproval,
      continuationContent:
        '已成功将产品方向与开发路线规划保存为便签。便签已保存，标题为《产品规划》。',
    });

    expect(content).toBe('');
  });

  it('keeps meaningful follow-up guidance inline in the same bubble', () => {
    const content = resolveApprovalContinuationContent({
      currentContent: '',
      existingApprovals: [executedApproval],
      latestApproval: executedApproval,
      continuationContent: '便签已保存。下一步建议你把这份规划拆成 4 个研发里程碑逐项推进。',
    });

    expect(content).toContain('下一步建议');
  });

  it('preserves markdown formatting when keeping meaningful follow-up guidance', () => {
    const content = resolveApprovalContinuationContent({
      currentContent: '',
      existingApprovals: [executedApproval],
      latestApproval: executedApproval,
      continuationContent: '## 下一步\n\n- 拆解里程碑\n- 建立任务清单',
    });

    expect(content).toBe('## 下一步\n\n- 拆解里程碑\n- 建立任务清单');
  });
});
