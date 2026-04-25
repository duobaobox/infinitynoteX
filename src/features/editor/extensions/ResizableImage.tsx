/**
 * 自定义可调整大小的图片扩展
 * 基于官方 TipTap demo 风格，使用 React NodeView 实现完全可控的样式
 *
 * 性能优化：
 * - 使用 React.memo 避免不必要的重渲染
 * - 优化事件处理和状态更新
 *
 * @see https://tiptap.dev/docs/guides/performance#react-node-views-performance
 */

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { DEFAULT_IMAGE_ALIGNMENT, normalizeImageAlignment } from '../utils/imageContent';

/**
 * ResizableImage 组件 - 官方 TipTap Demo 风格
 * 使用 React.memo 优化，只在 node.attrs 或 selected 变化时重渲染
 */
const ResizableImageComponent: React.FC<NodeViewProps> = memo(
  ({ node, updateAttributes, selected }) => {
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

    // 开始调整大小 - 使用 useCallback 缓存回调
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

        // 块级图片最多不超过编辑器可用宽度，避免溢出文档流。
        const containerWidth = containerRef.current?.offsetWidth || 800;
        const maxWidth = Math.max(50, containerWidth);
        newWidth = Math.min(newWidth, maxWidth);

        if (imgRef.current) {
          imgRef.current.style.width = `${newWidth}px`;
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        setResizeSide(null);
        // 只保存宽度，高度自动根据宽高比计算
        if (imgRef.current) {
          updateAttributes({
            width: imgRef.current.offsetWidth,
            height: null, // 不固定高度，让 CSS 自动保持宽高比
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

    const align = normalizeImageAlignment(node.attrs.align) ?? DEFAULT_IMAGE_ALIGNMENT;

    return (
      <NodeViewWrapper
        className={`resizable-image-wrapper align-${align} ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
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
              maxWidth: '100%',
              height: 'auto',
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
  },
  // 自定义比较函数 - 只在这些属性变化时重渲染
  (prevProps, nextProps) => {
    return (
      prevProps.selected === nextProps.selected &&
      prevProps.node.attrs.src === nextProps.node.attrs.src &&
      prevProps.node.attrs.width === nextProps.node.attrs.width &&
      prevProps.node.attrs.height === nextProps.node.attrs.height &&
      prevProps.node.attrs.align === nextProps.node.attrs.align &&
      prevProps.node.attrs.alt === nextProps.node.attrs.alt &&
      prevProps.node.attrs.title === nextProps.node.attrs.title
    );
  },
);

// 添加 displayName 用于调试
ResizableImageComponent.displayName = 'ResizableImageComponent';

/**
 * 创建自定义可调整大小的图片扩展
 */
export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: DEFAULT_IMAGE_ALIGNMENT,
        parseHTML: (element) =>
          normalizeImageAlignment(element.getAttribute('data-align')) ?? DEFAULT_IMAGE_ALIGNMENT,
        renderHTML: (attributes) => {
          const align = normalizeImageAlignment(attributes.align) ?? DEFAULT_IMAGE_ALIGNMENT;
          return { 'data-align': align };
        },
      },
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
