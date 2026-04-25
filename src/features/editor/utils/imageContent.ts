import type { TipTapJSONContent } from '../../../services/types';

export type ImageAlignment = 'left' | 'center' | 'right';

export const DEFAULT_IMAGE_ALIGNMENT: ImageAlignment = 'left';

const IMAGE_ALIGNMENTS = new Set<ImageAlignment>(['left', 'center', 'right']);

export function normalizeImageAlignment(value: unknown): ImageAlignment | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return IMAGE_ALIGNMENTS.has(value as ImageAlignment) ? (value as ImageAlignment) : undefined;
}

function cloneNodeWithContent(
  node: TipTapJSONContent,
  content: TipTapJSONContent[] | undefined,
): TipTapJSONContent {
  return content === undefined ? { ...node } : { ...node, content };
}

function normalizeNodeList(
  nodes: TipTapJSONContent[] | undefined,
): TipTapJSONContent[] | undefined {
  if (!nodes) {
    return undefined;
  }

  return nodes.flatMap((node) => normalizeNode(node));
}

function normalizeParagraphWithInlineImages(paragraph: TipTapJSONContent): TipTapJSONContent[] {
  const content = paragraph.content ?? [];

  if (!content.some((node) => node.type === 'image')) {
    return [cloneNodeWithContent(paragraph, normalizeNodeList(content))];
  }

  const normalizedNodes: TipTapJSONContent[] = [];
  let textBuffer: TipTapJSONContent[] = [];
  const paragraphAlign = normalizeImageAlignment(paragraph.attrs?.textAlign);

  const flushParagraph = () => {
    if (textBuffer.length === 0) {
      return;
    }

    normalizedNodes.push({
      ...paragraph,
      content: textBuffer,
    });
    textBuffer = [];
  };

  for (const child of content) {
    if (child.type === 'image') {
      flushParagraph();

      normalizedNodes.push({
        ...cloneNodeWithContent(child, normalizeNodeList(child.content)),
        attrs: {
          ...child.attrs,
          align:
            normalizeImageAlignment(child.attrs?.align) ??
            paragraphAlign ??
            DEFAULT_IMAGE_ALIGNMENT,
        },
      });
      continue;
    }

    textBuffer.push(...normalizeNode(child));
  }

  flushParagraph();

  return normalizedNodes;
}

function normalizeNode(node: TipTapJSONContent): TipTapJSONContent[] {
  if (node.type === 'paragraph') {
    return normalizeParagraphWithInlineImages(node);
  }

  return [cloneNodeWithContent(node, normalizeNodeList(node.content))];
}

export function normalizeLegacyInlineImages(content: TipTapJSONContent): TipTapJSONContent {
  if (!content || typeof content !== 'object' || !content.content) {
    return content;
  }

  return {
    ...content,
    content: normalizeNodeList(content.content),
  };
}

export function normalizeEditorContent(
  content: TipTapJSONContent | string | null | undefined,
): TipTapJSONContent | string {
  if (!content) {
    return { type: 'doc', content: [] };
  }

  if (typeof content === 'string') {
    return content;
  }

  return normalizeLegacyInlineImages(content);
}
