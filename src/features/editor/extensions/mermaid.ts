/**
 * Mermaid 编辑器辅助能力
 * 统一放置 Mermaid 识别、默认模板与语法校验逻辑
 */

import type { JSONContent } from '@tiptap/core';

export const MERMAID_LANGUAGE = 'mermaid';

export const DEFAULT_MERMAID_TEMPLATE = `graph TD
    A[开始] --> B[结束]`;

export interface MermaidValidationSuccess {
  valid: true;
  diagramType: string;
}

export interface MermaidValidationFailure {
  valid: false;
  message: string;
  hint: string;
  detail?: string;
  line?: number;
}

export type MermaidValidationResult = MermaidValidationSuccess | MermaidValidationFailure;

interface MermaidParseHash {
  line?: number;
  token?: string;
  loc?: {
    first_line?: number;
  };
}

interface MermaidParseErrorLike {
  message?: string;
  hash?: MermaidParseHash;
}

type MermaidRuntime = typeof import('mermaid').default;

let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null;

export const normalizeMermaidText = (text: string): string => {
  return text.replace(/\r\n/g, '\n').trim();
};

const loadMermaidRuntime = async (): Promise<MermaidRuntime> => {
  if (!mermaidRuntimePromise) {
    mermaidRuntimePromise = import('mermaid').then((module) => module.default);
  }

  return mermaidRuntimePromise;
};

const isObjectLike = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getMermaidErrorLine = (error: unknown): number | undefined => {
  if (!isObjectLike(error)) return undefined;

  const hash = (error as MermaidParseErrorLike).hash;
  if (!isObjectLike(hash)) return undefined;

  if (typeof hash.line === 'number' && Number.isFinite(hash.line) && hash.line > 0) {
    return hash.line;
  }

  const loc = isObjectLike(hash.loc) ? (hash.loc as MermaidParseHash['loc']) : undefined;
  const firstLine = loc?.first_line;
  if (typeof firstLine === 'number' && Number.isFinite(firstLine) && firstLine > 0) {
    return firstLine;
  }

  return undefined;
};

const getMermaidErrorToken = (error: unknown): string | undefined => {
  if (!isObjectLike(error)) return undefined;

  const hash = (error as MermaidParseErrorLike).hash;
  return typeof hash?.token === 'string' ? hash.token : undefined;
};

const getMermaidErrorDetail = (error: unknown): string | undefined => {
  if (typeof error === 'string') {
    const detail = error.trim();
    return detail || undefined;
  }

  if (error instanceof Error) {
    const detail = error.message.trim();
    return detail || undefined;
  }

  if (isObjectLike(error) && typeof error.message === 'string') {
    const detail = error.message.trim();
    return detail || undefined;
  }

  return undefined;
};

export const formatMermaidValidationError = (error: unknown): MermaidValidationFailure => {
  const line = getMermaidErrorLine(error);
  const token = getMermaidErrorToken(error);
  const detail = getMermaidErrorDetail(error);

  const message =
    token === 'EOF'
      ? line
        ? `第 ${line} 行看起来还没写完整，暂时无法生成图表。`
        : '这段 Mermaid 语法还没写完整，暂时无法生成图表。'
      : line
        ? `第 ${line} 行附近有 Mermaid 语法问题，暂时无法生成图表。`
        : 'Mermaid 语法有误，暂时无法生成图表。';

  const hint =
    token === 'EOF'
      ? '优先检查这一行是不是还没写完整，尤其是箭头、节点标签、括号或引号是否还没闭合。'
      : '可以重点检查这附近的关键字、箭头写法和括号是否正确。';

  return {
    valid: false,
    message,
    hint,
    detail,
    line,
  };
};

/**
 * 检测文本是否可能是 Mermaid 图表源码
 * 支持用户直接粘贴裸 Mermaid 文本，而不是 fenced code block。
 */
export const isLikelyMermaid = (text: string): boolean => {
  if (!text || text.trim().length === 0) return false;

  const normalized = normalizeMermaidText(text);
  if (!normalized) return false;

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return false;

  const firstMeaningfulLine = lines.find((line) => !line.startsWith('%%'));
  if (!firstMeaningfulLine) return false;

  const mermaidStartPattern =
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|requirementDiagram|quadrantChart|xychart-beta|sankey-beta|block-beta|packet-beta|kanban)\b/i;

  return mermaidStartPattern.test(firstMeaningfulLine);
};

export const createMermaidCodeBlock = (text: string): JSONContent => {
  const normalized = normalizeMermaidText(text);

  return {
    type: 'codeBlock',
    attrs: {
      language: MERMAID_LANGUAGE,
    },
    content: normalized
      ? [
          {
            type: 'text',
            text: normalized,
          },
        ]
      : [],
  };
};

export const validateMermaidSyntax = async (text: string): Promise<MermaidValidationResult> => {
  const normalized = normalizeMermaidText(text);

  try {
    const mermaid = await loadMermaidRuntime();
    const result = await mermaid.parse(normalized);

    return {
      valid: true,
      diagramType: result.diagramType,
    };
  } catch (error) {
    return formatMermaidValidationError(error);
  }
};
