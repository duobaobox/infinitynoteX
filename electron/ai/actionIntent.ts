const SAVE_TO_NOTE_PATTERNS = [
  /(创建|新建|保存(成|为)?|生成|整理(成)?|总结(成)?).*(便签|笔记|标签)/i,
  /(便签|笔记|标签).*(创建|新建|保存|生成)/i,
];

const APPEND_TO_NOTE_PATTERNS = [
  /(追加|补充|写回|添加).*(当前|这条|该)?(便签|笔记|标签)/i,
  /(当前|这条|该)(便签|笔记|标签).*(追加|补充|写回|添加)/i,
];

const CREATE_TASK_PATTERNS = [
  /(创建|新建|生成|整理(成)?|拆解(成)?).*(任务|待办|todo)/i,
  /(任务|待办|todo).*(创建|新建|生成)/i,
];

export type RequiredToolName = 'saveToNote' | 'appendToNote' | 'createManualTask';

export function detectRequiredTools(message: string): RequiredToolName[] {
  const normalized = message.trim();
  if (!normalized) {
    return [];
  }

  const tools = new Set<RequiredToolName>();

  if (APPEND_TO_NOTE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    tools.add('appendToNote');
  }

  if (SAVE_TO_NOTE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    tools.add('saveToNote');
  }

  if (CREATE_TASK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    tools.add('createManualTask');
  }

  return [...tools];
}

export function buildUnsupportedToolActionMessage(requiredTools: RequiredToolName[]): string {
  const targetLabel =
    requiredTools.length === 1
      ? requiredTools[0] === 'createManualTask'
        ? '创建任务'
        : requiredTools[0] === 'appendToNote'
          ? '追加到便签'
          : '创建便签'
      : '这些落地动作';

  return `当前所选模型不支持工具调用，我还不能真的帮你${targetLabel}。请切换到支持“工具调用”的模型后再试，我再发起实际执行。`;
}
