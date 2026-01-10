import { describe, it, expect } from 'vitest';
import { deepMerge } from '../deepMerge';

describe('deepMerge', () => {
  it('should merge nested objects safely', () => {
    const target = { a: 1, b: { c: 2 } };
    const source = { b: { d: 3 } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = deepMerge(target, source as unknown as any);
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 } });
  });

  it('should overwrite primitive values', () => {
    const target = { a: 1 };
    const source = { a: 2 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 2 });
  });

  it('should handle undefined to delete keys', () => {
    const target = { a: 1, b: 2 };
    const source = { b: undefined };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1 });
  });

  it('should not merge arrays (replace them)', () => {
    const target = { a: [1, 2] };
    const source = { a: [3, 4] };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: [3, 4] });
  });

  it('should handle null values correctly', () => {
    const target = { a: { b: 1 } };
    const source = { a: null }; // Should replace object with null? Or throw?
    // Based on implementation: if sourceValue !== null ... else (lines 112) result[key] = sourceValue
    // So it replaces.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = deepMerge(target, source as unknown as any);
    expect(result).toEqual({ a: null });
  });
});
