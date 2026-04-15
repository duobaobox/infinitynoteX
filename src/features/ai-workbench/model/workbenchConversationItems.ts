import type { AIConversationPreview } from '../../../constants/tools';
import type { AIConversationBinding, AIConversationSource } from '../../../services/types';

export const GLOBAL_AI_WORKBENCH_ITEM_ID = 'ai-workbench:global';
export const CANVAS_AI_WORKBENCH_ITEM_ID = 'ai-workbench:canvas';

export type AIWorkbenchConversationFilter = 'all' | AIConversationSource;

export interface AIWorkbenchConversationItem {
  id: string;
  conversationId: string | null;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  source: AIConversationSource;
  binding: AIConversationBinding | null;
  isSystemEntry: boolean;
  deletable: boolean;
}

const AI_WORKBENCH_SOURCE_META: Record<
  AIConversationSource,
  {
    label: string;
    defaultTitle: string;
    defaultExcerpt: string;
  }
> = {
  global: {
    label: '全局',
    defaultTitle: '全局 AI 对话',
    defaultExcerpt: '悬浮窗口与 AI 工坊共享同一条全局 AI 会话。',
  },
  workbench: {
    label: '工坊',
    defaultTitle: 'AI 工坊对话',
    defaultExcerpt: '在 AI 工坊中新建和管理的独立对话。',
  },
  note: {
    label: '便签',
    defaultTitle: '便签 AI 对话',
    defaultExcerpt: '绑定到具体便签的上下文对话，会跟随便签生命周期流转。',
  },
  canvas: {
    label: '画布',
    defaultTitle: '画布 AI',
    defaultExcerpt: '画布 AI 当前仍在画布页内使用，工坊里先作为统一入口展示。',
  },
};

export const AI_WORKBENCH_SOURCE_ORDER: AIConversationSource[] = [
  'global',
  'workbench',
  'note',
  'canvas',
];

function getPreviewSource(preview: AIConversationPreview): AIConversationSource {
  return preview.source ?? 'workbench';
}

function buildBinding(
  source: AIConversationSource,
  sourceEntityId?: string,
): AIConversationBinding | null {
  if ((source === 'note' || source === 'global') && sourceEntityId) {
    return {
      source,
      entityId: sourceEntityId,
    };
  }

  return null;
}

function formatPreviewExcerpt(preview: AIConversationPreview): string {
  const source = getPreviewSource(preview);
  const meta = AI_WORKBENCH_SOURCE_META[source];
  const trimmedExcerpt = preview.excerpt?.trim();

  if (trimmedExcerpt) {
    return `${meta.label} · ${trimmedExcerpt}`;
  }

  return meta.defaultExcerpt;
}

function toConversationItem(preview: AIConversationPreview): AIWorkbenchConversationItem {
  const source = getPreviewSource(preview);

  return {
    id: preview.id,
    conversationId: preview.id,
    title: preview.title || AI_WORKBENCH_SOURCE_META[source].defaultTitle,
    excerpt: formatPreviewExcerpt(preview),
    createdAt: preview.createdAt,
    updatedAt: preview.updatedAt,
    source,
    binding: buildBinding(source, preview.sourceEntityId),
    isSystemEntry: false,
    deletable: true,
  };
}

function sortByUpdatedAt(
  items: AIWorkbenchConversationItem[],
  sortOrder: 'asc' | 'desc',
): AIWorkbenchConversationItem[] {
  return [...items].sort((a, b) =>
    sortOrder === 'asc' ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt,
  );
}

function buildGlobalItem(preview: AIConversationPreview | undefined): AIWorkbenchConversationItem {
  return {
    id: GLOBAL_AI_WORKBENCH_ITEM_ID,
    conversationId: preview?.id ?? null,
    title: preview?.title || AI_WORKBENCH_SOURCE_META.global.defaultTitle,
    excerpt: preview?.excerpt?.trim() || AI_WORKBENCH_SOURCE_META.global.defaultExcerpt,
    createdAt: preview?.createdAt ?? 0,
    updatedAt: preview?.updatedAt ?? 0,
    source: 'global',
    binding: {
      source: 'global',
      entityId: preview?.sourceEntityId || 'default',
    },
    isSystemEntry: true,
    deletable: !!preview?.id,
  };
}

function buildCanvasEntry(): AIWorkbenchConversationItem {
  return {
    id: CANVAS_AI_WORKBENCH_ITEM_ID,
    conversationId: null,
    title: AI_WORKBENCH_SOURCE_META.canvas.defaultTitle,
    excerpt: AI_WORKBENCH_SOURCE_META.canvas.defaultExcerpt,
    createdAt: 0,
    updatedAt: 0,
    source: 'canvas',
    binding: null,
    isSystemEntry: true,
    deletable: false,
  };
}

export function getAIWorkbenchSourceLabel(source: AIConversationSource): string {
  return AI_WORKBENCH_SOURCE_META[source].label;
}

export function buildAIWorkbenchItems(
  previews: AIConversationPreview[],
  sortOrder: 'asc' | 'desc' = 'desc',
): AIWorkbenchConversationItem[] {
  const globalPreviews = previews.filter((preview) => getPreviewSource(preview) === 'global');
  const globalPreview = [...globalPreviews].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  const workbenchItems = sortByUpdatedAt(
    previews
      .filter((preview) => getPreviewSource(preview) === 'workbench')
      .map((preview) => toConversationItem(preview)),
    sortOrder,
  );

  const noteItems = sortByUpdatedAt(
    previews
      .filter((preview) => getPreviewSource(preview) === 'note')
      .map((preview) => toConversationItem(preview)),
    sortOrder,
  );

  const canvasItems = sortByUpdatedAt(
    previews
      .filter((preview) => getPreviewSource(preview) === 'canvas')
      .map((preview) => toConversationItem(preview)),
    sortOrder,
  );

  return [
    buildGlobalItem(globalPreview),
    ...workbenchItems,
    ...noteItems,
    ...(canvasItems.length > 0 ? canvasItems : [buildCanvasEntry()]),
  ];
}

export function normalizeAIWorkbenchSelectionId(
  selectionId: string | null,
  previews: AIConversationPreview[],
): string | null {
  if (!selectionId) {
    return null;
  }

  if (selectionId === GLOBAL_AI_WORKBENCH_ITEM_ID || selectionId === CANVAS_AI_WORKBENCH_ITEM_ID) {
    return selectionId;
  }

  const selectedPreview = previews.find((preview) => preview.id === selectionId);
  if (selectedPreview && getPreviewSource(selectedPreview) === 'global') {
    return GLOBAL_AI_WORKBENCH_ITEM_ID;
  }

  return selectionId;
}

export function resolveAIWorkbenchSelection(
  selectionId: string | null,
  previews: AIConversationPreview[],
): AIWorkbenchConversationItem | null {
  const normalizedSelectionId = normalizeAIWorkbenchSelectionId(selectionId, previews);
  if (!normalizedSelectionId) {
    return null;
  }

  return buildAIWorkbenchItems(previews).find((item) => item.id === normalizedSelectionId) ?? null;
}

export function getDefaultAIWorkbenchSelectionId(): string {
  return GLOBAL_AI_WORKBENCH_ITEM_ID;
}

export function matchesAIWorkbenchQuery(item: AIWorkbenchConversationItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    item.title,
    item.excerpt,
    getAIWorkbenchSourceLabel(item.source),
    item.source,
    item.isSystemEntry ? '系统入口' : '对话',
  ].some((field) => field.toLowerCase().includes(normalizedQuery));
}
