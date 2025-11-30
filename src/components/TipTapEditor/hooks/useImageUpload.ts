/**
 * 图片上传 Hook
 * 处理图片文件上传和 Base64 转换
 */

import { useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/core';

/**
 * 使用图片上传功能
 */
export const useImageUpload = (editor: Editor | null) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!editor) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const src = evt.target?.result as string;
        if (src) {
          editor.chain().focus().setImage({ src }).run();
        }
      };
      reader.readAsDataURL(file);

      // 清空 input,允许重复上传同一文件
      e.target.value = '';
    },
    [editor],
  );

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    handleImageUpload,
    triggerUpload,
  };
};
