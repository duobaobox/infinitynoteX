const IMPERATIVE_MARKERS = /(请|帮我|麻烦|直接|现在|立刻|马上|给我|替我)/i;
const QUESTION_MARKERS =
  /(如何|怎么|为何|为什么|是什么|吗|么|是否|能不能|可以吗|举例|介绍|解释|\?|\uFF1F)/i;
const NEGATIVE_MARKERS = /(不要|别|无需|不用|先别|暂不|不需要|仅讨论|只是讨论)/i;

const SAVE_TO_NOTE_STRONG_PATTERNS = [
  /(创建|新建|保存(成|为)?|生成|整理(成)?|总结(成)?).*(便签|笔记|标签)/i,
  /(便签|笔记|标签).*(创建|新建|保存|生成)/i,
];

const APPEND_TO_NOTE_STRONG_PATTERNS = [
  /(追加|补充|写回|添加).*(当前|这条|该)?(便签|笔记|标签)/i,
  /(当前|这条|该)(便签|笔记|标签).*(追加|补充|写回|添加)/i,
];

const CREATE_TASK_STRONG_PATTERNS = [
  /(创建|新建|生成|整理(成)?|拆解(成)?).*(任务|待办|todo)/i,
  /(任务|待办|todo).*(创建|新建|生成)/i,
  /(安排|记录|添加).*(任务|待办|todo)/i,
];

const SAVE_TO_NOTE_WEAK_PATTERN =
  /(保存|沉淀|记成|写成).*(便签|笔记|标签)|(便签|笔记|标签).*(保存|沉淀|记成|写成)/i;
const APPEND_TO_NOTE_WEAK_PATTERN = /(追加|补充|写回)/i;
const CREATE_TASK_WEAK_PATTERN =
  /(安排|记录|跟进|行动).*(任务|待办|todo)|(任务|待办|todo).*(安排|记录|跟进|行动)/i;

export type RequiredToolName = 'saveToNote' | 'appendToNote' | 'createManualTask';

export interface ToolIntentAnalysis {
  requiredTools: RequiredToolName[];
  confidence: 'none' | 'low' | 'medium' | 'high';
  isActionable: boolean;
}

function scoreToolIntent(args: {
  message: string;
  strongPatterns: RegExp[];
  weakPattern: RegExp;
}): number {
  const { message, strongPatterns, weakPattern } = args;
  const hasStrongMatch = strongPatterns.some((pattern) => pattern.test(message));
  const hasWeakMatch = weakPattern.test(message);

  if (!hasStrongMatch && !hasWeakMatch) {
    return 0;
  }

  let score = 0;
  if (hasStrongMatch) {
    score += 3;
  } else if (hasWeakMatch) {
    score += 1;
  }

  if (IMPERATIVE_MARKERS.test(message)) {
    score += 1;
  }

  if (QUESTION_MARKERS.test(message)) {
    score -= 2;
  }

  if (NEGATIVE_MARKERS.test(message)) {
    score -= 3;
  }

  return Math.max(0, score);
}

function toConfidence(maxScore: number): ToolIntentAnalysis['confidence'] {
  if (maxScore >= 4) return 'high';
  if (maxScore >= 2) return 'medium';
  if (maxScore >= 1) return 'low';
  return 'none';
}

export function analyzeToolIntent(message: string): ToolIntentAnalysis {
  const normalized = message.trim();
  if (!normalized) {
    return {
      requiredTools: [],
      confidence: 'none',
      isActionable: false,
    };
  }

  const saveScore = scoreToolIntent({
    message: normalized,
    strongPatterns: SAVE_TO_NOTE_STRONG_PATTERNS,
    weakPattern: SAVE_TO_NOTE_WEAK_PATTERN,
  });
  const appendScore = scoreToolIntent({
    message: normalized,
    strongPatterns: APPEND_TO_NOTE_STRONG_PATTERNS,
    weakPattern: APPEND_TO_NOTE_WEAK_PATTERN,
  });
  const taskScore = scoreToolIntent({
    message: normalized,
    strongPatterns: CREATE_TASK_STRONG_PATTERNS,
    weakPattern: CREATE_TASK_WEAK_PATTERN,
  });

  const requiredTools: RequiredToolName[] = [];
  if (saveScore >= 1) {
    requiredTools.push('saveToNote');
  }
  if (appendScore >= 1) {
    requiredTools.push('appendToNote');
  }
  if (taskScore >= 1) {
    requiredTools.push('createManualTask');
  }

  const confidence = toConfidence(Math.max(saveScore, appendScore, taskScore));

  return {
    requiredTools,
    confidence,
    isActionable: confidence === 'medium' || confidence === 'high',
  };
}

export function detectRequiredTools(message: string): RequiredToolName[] {
  return analyzeToolIntent(message).requiredTools;
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
