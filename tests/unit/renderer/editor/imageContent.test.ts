import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { ResizableImage } from '../../../../src/features/editor/extensions/ResizableImage';
import { normalizeLegacyInlineImages } from '../../../../src/features/editor/utils/imageContent';

describe('normalizeLegacyInlineImages', () => {
  it('会把旧版段落内图片拆成块级图片，并继承原段落对齐方式', () => {
    const legacyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'center',
          },
          content: [
            {
              type: 'text',
              text: '前文',
            },
            {
              type: 'image',
              attrs: {
                src: 'attachment://image-1',
              },
            },
            {
              type: 'text',
              text: '后文',
            },
          ],
        },
      ],
    };

    const normalized = normalizeLegacyInlineImages(legacyDoc);

    expect(normalized.content).toHaveLength(3);
    expect(normalized.content?.[0]).toMatchObject({
      type: 'paragraph',
      attrs: {
        textAlign: 'center',
      },
      content: [
        {
          type: 'text',
          text: '前文',
        },
      ],
    });
    expect(normalized.content?.[1]).toMatchObject({
      type: 'image',
      attrs: {
        src: 'attachment://image-1',
        align: 'center',
      },
    });
    expect(normalized.content?.[2]).toMatchObject({
      type: 'paragraph',
      attrs: {
        textAlign: 'center',
      },
      content: [
        {
          type: 'text',
          text: '后文',
        },
      ],
    });
  });
});

describe('ResizableImage', () => {
  it('插入图片时使用块级节点，并带默认左对齐属性', () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        ResizableImage.configure({
          allowBase64: true,
          HTMLAttributes: {
            class: 'editor-image',
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
          },
        ],
      },
    });

    try {
      editor.commands.setImage({ src: 'attachment://image-2' });

      const imageNode = editor.getJSON().content?.find((node) => node.type === 'image');

      expect(editor.schema.nodes.image.spec.group).toBe('block');
      expect(imageNode).toMatchObject({
        type: 'image',
        attrs: {
          src: 'attachment://image-2',
          align: 'left',
        },
      });
    } finally {
      editor.destroy();
    }
  });
});
