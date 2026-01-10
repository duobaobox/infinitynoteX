/**
 * 图片上传组件
 */

import React from 'react';
import { useImageUpload } from '../../hooks';
import type { Editor } from '@tiptap/core';

export interface ImageUploaderProps {
  editor: Editor;
}

/**
 * 图片上传组件 (仅包含隐藏的 input 和上传逻辑)
 */
export const ImageUploader: React.FC<ImageUploaderProps> = ({ editor }) => {
  const { fileInputRef, handleImageUpload } = useImageUpload(editor);

  return (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: 'none' }}
      onChange={handleImageUpload}
    />
  );
};
