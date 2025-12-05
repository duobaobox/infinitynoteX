/**
 * useScrollOverflow - 滚动溢出检测 Hook
 *
 * 检测元素是否有垂直滚动条，用于动态调整 padding
 */

import { useEffect, useState, useRef, RefObject } from 'react';

interface UseScrollOverflowOptions {
  /** 溢出时的 padding 值 */
  overflowPadding?: string;
  /** 不溢出时的 padding 值 */
  normalPadding?: string;
}

interface UseScrollOverflowReturn {
  /** 滚动容器的 ref */
  scrollableRef: RefObject<HTMLDivElement>;
  /** 需要调整 padding 的容器 ref */
  containerRef: RefObject<HTMLDivElement>;
  /** 是否溢出 */
  isOverflow: boolean;
}

export const useScrollOverflow = (
  options: UseScrollOverflowOptions = {},
): UseScrollOverflowReturn => {
  const { overflowPadding = '0px', normalPadding = '10px' } = options;

  const scrollableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  // 检测滚动条
  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) return;

    const checkOverflow = () => {
      const hasVerticalScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      setIsOverflow(hasVerticalScroll);
    };

    // 初始检测
    checkOverflow();

    // 监听尺寸变化
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(scrollableElement);

    // 监听内容变化
    const mutationObserver = new MutationObserver(checkOverflow);
    mutationObserver.observe(scrollableElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // 动态更新 padding
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.paddingRight = isOverflow ? overflowPadding : normalPadding;
    }
  }, [isOverflow, overflowPadding, normalPadding]);

  return {
    scrollableRef,
    containerRef,
    isOverflow,
  };
};

export default useScrollOverflow;
