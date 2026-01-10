import type { DeepPartial } from '../types/config';

/**
 * 深度合并对象
 */
export function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key as keyof DeepPartial<T>];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      // 如果 source 值为 undefined，删除该键（用于插件卸载等场景）
      delete result[key];
    } else if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // 递归合并对象
      // @ts-expect-error 复杂的泛型递归合并，TS 难以推断，这里使用 expect-error 压制
      result[key] = deepMerge(targetValue as object, sourceValue as object);
    } else {
      // 直接覆盖
      // @ts-expect-error 类型不匹配，直接覆盖
      result[key] = sourceValue;
    }
  }

  return result;
}
