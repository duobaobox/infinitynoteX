/**
 * useDebouncedSearch - 防抖搜索 Hook
 *
 * 提供防抖的搜索输入状态管理
 */

import { useState, useEffect, useRef } from 'react';

interface UseDebouncedSearchOptions {
  /** 防抖延迟时间（毫秒） */
  delay?: number;
  /** 初始搜索值 */
  initialValue?: string;
}

interface UseDebouncedSearchReturn {
  /** 即时输入值 */
  searchInput: string;
  /** 设置即时输入值 */
  setSearchInput: (value: string) => void;
  /** 防抖后的搜索值（用于实际过滤） */
  searchQuery: string;
}

export const useDebouncedSearch = (
  options: UseDebouncedSearchOptions = {},
): UseDebouncedSearchReturn => {
  const { delay = 300, initialValue = '' } = options;

  const [searchInput, setSearchInput] = useState(initialValue);
  const [searchQuery, setSearchQuery] = useState(initialValue);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [searchInput, delay]);

  return {
    searchInput,
    setSearchInput,
    searchQuery,
  };
};

export default useDebouncedSearch;
