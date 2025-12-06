/**
 * 自定义可调整大小的图片扩展
 * 基于官方 TipTap demo 风格，使用 React NodeView 实现完全可控的样式
 */

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ResizableImage 组件 - 官方 TipTap Demo 风格
 */
const ResizableImageComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const aspectRatioRef = useRef(1);
  const originalWidthRef = useRef(0); // 记录图片原始宽度

  // 计算初始宽高比和原始尺寸
  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      const handleLoad = () => {
        if (img.naturalWidth) {
          aspectRatioRef.current = img.naturalWidth / img.naturalHeight;
          originalWidthRef.current = img.naturalWidth;
        }
      };

      if (img.complete && img.naturalWidth) {
        handleLoad();
      } else {
        img.addEventListener('load', handleLoad);
        return () => img.removeEventListener('load', handleLoad);
      }
    }
  }, [node.attrs.src]);

  // 开始调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeSide(side);
    startXRef.current = e.clientX;
    startWidthRef.current = imgRef.current?.offsetWidth || 300;

    // 保存宽高比
    if (imgRef.current && imgRef.current.naturalWidth) {
      aspectRatioRef.current = imgRef.current.naturalWidth / imgRef.current.naturalHeight;
      originalWidthRef.current = imgRef.current.naturalWidth;
    }
  }, []);

  // 处理调整大小
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      let newWidth: number;

      if (resizeSide === 'left') {
        newWidth = startWidthRef.current - deltaX;
      } else {
        newWidth = startWidthRef.current + deltaX;
      }

      // 限制最小宽度
      newWidth = Math.max(50, newWidth);

      // 限制最大宽度：取容器宽度和原始图片宽度的最大值（允许放大到原始尺寸或容器宽度）
      const containerWidth = containerRef.current?.parentElement?.parentElement?.offsetWidth || 800;
      const originalWidth = originalWidthRef.current || 800;
      const maxWidth = Math.max(containerWidth, originalWidth);
      newWidth = Math.min(newWidth, maxWidth);

      // 计算对应高度（保持宽高比）
      const newHeight = Math.round(newWidth / aspectRatioRef.current);

      if (imgRef.current) {
        imgRef.current.style.width = `${newWidth}px`;
        imgRef.current.style.height = `${newHeight}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeSide(null);
      // 保存最终尺寸到节点属性
      if (imgRef.current) {
        updateAttributes({
          width: imgRef.current.offsetWidth,
          height: imgRef.current.offsetHeight,
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeSide, updateAttributes]);

  return (
    <NodeViewWrapper
      as="div"
      className={`resizable-image-wrapper ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
      ref={containerRef}
      data-drag-handle
    >
      <div className="resizable-image-container">
        {/* 左侧拖拽手柄 */}
        <div
          className="resize-handle resize-handle-left"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />

        {/* 图片 */}
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || ''}
          style={{
            width: node.attrs.width ? `${node.attrs.width}px` : 'auto',
            height: node.attrs.height ? `${node.attrs.height}px` : 'auto',
          }}
          draggable={false}
        />

        {/* 右侧拖拽手柄 */}
        <div
          className="resize-handle resize-handle-right"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
      </div>
    </NodeViewWrapper>
  );
};

/**
 * 创建自定义可调整大小的图片扩展
 */
export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute('height'),
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});

export default ResizableImage;
