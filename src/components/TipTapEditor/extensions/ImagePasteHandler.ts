/**
 * 图片粘贴处理扩展
 *
 * 拦截粘贴事件，将 base64 图片保存到 attachments 目录，
 * 并使用 attachment:// 协议引用图片，而非内嵌 base64 数据。
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * 将 File 对象读取为 Data URL
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 保存图片到 attachments 并返回 attachment:// URL
 */
async function saveImageToAttachments(file: File): Promise<string | null> {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await window.attachments.save(dataUrl);

    if (!result.success || !result.id) {
      console.error('[ImagePasteHandler] Save failed:', result.error);
      return null;
    }

    console.log(`[ImagePasteHandler] Image saved: ${result.id}`);
    return `attachment://${result.id}`;
  } catch (error) {
    console.error('[ImagePasteHandler] Upload failed:', error);
    return null;
  }
}

/**
 * 图片粘贴处理扩展
 *
 * 功能：
 * - 拦截粘贴事件中的图片文件
 * - 将图片保存到 attachments 目录
 * - 插入使用 attachment:// 协议的图片节点
 * - 拦截拖放事件中的图片文件
 */
export const ImagePasteHandler = Extension.create({
  name: 'imagePasteHandler',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('imagePasteHandler'),

        props: {
          /**
           * 处理粘贴事件
           */
          handlePaste(_view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            // 检查是否有图片文件
            const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'));

            if (imageItems.length === 0) {
              return false; // 没有图片，让 TipTap 默认处理
            }

            // 阻止默认行为
            event.preventDefault();

            // 异步处理图片上传
            (async () => {
              for (const item of imageItems) {
                const file = item.getAsFile();
                if (!file) continue;

                const attachmentUrl = await saveImageToAttachments(file);
                if (attachmentUrl) {
                  editor.chain().focus().setImage({ src: attachmentUrl }).run();
                }
              }
            })();

            return true; // 表示已处理
          },

          /**
           * 处理拖放事件
           */
          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            // 检查是否有图片文件
            const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

            if (imageFiles.length === 0) {
              return false; // 没有图片，让 TipTap 默认处理
            }

            // 阻止默认行为
            event.preventDefault();

            // 获取拖放位置
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            // 异步处理图片上传
            (async () => {
              for (const file of imageFiles) {
                const attachmentUrl = await saveImageToAttachments(file);
                if (attachmentUrl) {
                  // 如果有坐标，在指定位置插入；否则在当前光标位置插入
                  if (coordinates) {
                    editor
                      .chain()
                      .focus()
                      .insertContentAt(coordinates.pos, {
                        type: 'image',
                        attrs: { src: attachmentUrl },
                      })
                      .run();
                  } else {
                    editor.chain().focus().setImage({ src: attachmentUrl }).run();
                  }
                }
              }
            })();

            return true; // 表示已处理
          },
        },
      }),
    ];
  },
});

export default ImagePasteHandler;
