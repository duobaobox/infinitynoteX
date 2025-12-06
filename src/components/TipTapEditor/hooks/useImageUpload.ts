/**
 * 图片上传 Hook
 * 处理图片文件上传，保存为本地文件并使用自定义协议引用
 *
 * 改进：
 * - 图片保存到 attachments/ 目录，而非 Base64 内嵌
 * - 使用 attachment:// 协议引用图片
 * - 自动压缩图片（在主进程完成）
 */

import { useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/core';

/**
 * 使用图片上传功能
 */
export const useImageUpload = (editor: Editor | null) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 处理图片上传
   * 1. 读取文件为 Data URL
   * 2. 调用主进程保存为文件（自动压缩）
   * 3. 插入使用 attachment:// 协议的图片
   */
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!editor) return;

      try {
        // 读取文件为 Data URL
        const dataUrl = await readFileAsDataUrl(file);

        // 调用主进程保存附件
        const result = await window.attachments.save(dataUrl);

        if (!result.success || !result.id) {
          console.error('[ImageUpload] Save failed:', result.error);
          return;
        }

        // 使用自定义协议引用图片
        const src = `attachment://${result.id}`;
        editor.chain().focus().setImage({ src }).run();

        console.log(`[ImageUpload] Image saved: ${result.id}`);
      } catch (error) {
        console.error('[ImageUpload] Upload failed:', error);
      }

      // 清空 input，允许重复上传同一文件
      e.target.value = '';
    },
    [editor],
  );

  /**
   * 触发文件选择对话框
   */
  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 从剪贴板粘贴图片
   * 用于外部调用（TipTap 扩展中）
   */
  const uploadFromClipboard = useCallback(
    async (file: File): Promise<string | null> => {
      if (!editor) return null;

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const result = await window.attachments.save(dataUrl);

        if (!result.success || !result.id) {
          console.error('[ImageUpload] Clipboard save failed:', result.error);
          return null;
        }

        return `attachment://${result.id}`;
      } catch (error) {
        console.error('[ImageUpload] Clipboard upload failed:', error);
        return null;
      }
    },
    [editor],
  );

  return {
    fileInputRef,
    handleImageUpload,
    triggerUpload,
    uploadFromClipboard,
  };
};

/**
 * 读取文件为 Data URL
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
