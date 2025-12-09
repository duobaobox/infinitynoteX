/**
 * useDebouncedSearch 测试
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedSearch } from '../../../../src/hooks/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useDebouncedSearch());
    expect(result.current.searchInput).toBe('');
    expect(result.current.searchQuery).toBe('');
  });

  it('should initialize with provided initial value', () => {
    const { result } = renderHook(() => useDebouncedSearch({ initialValue: 'init' }));
    expect(result.current.searchInput).toBe('init');
    expect(result.current.searchQuery).toBe('init');
  });

  it('should update searchInput immediately but debounce searchQuery', () => {
    const { result } = renderHook(() => useDebouncedSearch({ delay: 500 }));

    act(() => {
      result.current.setSearchInput('test');
    });

    // Immediate input update
    expect(result.current.searchInput).toBe('test');
    // Query should not update yet
    expect(result.current.searchQuery).toBe('');

    // Fast forward slightly less than 500ms
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.searchQuery).toBe('');

    // Fast forward remaining time
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.searchQuery).toBe('test');
  });

  it('should reset timer on subsequent updates', () => {
    const { result } = renderHook(() => useDebouncedSearch({ delay: 500 }));

    act(() => {
      result.current.setSearchInput('a');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Update input again before timeout
    act(() => {
      result.current.setSearchInput('ab');
    });

    // Should wait full 500ms from SECOND update
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Total 600ms from start, but only 300ms from second update
    expect(result.current.searchQuery).toBe(''); // Initial was empty? Wait, intial was '', first update scheduled 'a', cancelled. second scheduled 'ab'.
    // Note: implementation sets searchQuery, so it holds previous value (or initial)

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.searchQuery).toBe('ab');
  });
});
