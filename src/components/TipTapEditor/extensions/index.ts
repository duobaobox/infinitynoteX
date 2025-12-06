/**
 * TipTap 扩展集合
 * 统一导出所有扩展配置
 */

import { getBasicExtensions, type EditorConfig } from './basic';
import { getFormattingExtensions } from './formatting';
import { getContentExtensions } from './content';
import { getTaskExtensions } from './task';
import { getEnhancementExtensions } from './enhancements';

/**
 * 获取所有编辑器扩展
 * 模块化组织,便于维护和扩展
 */
export const getExtensions = (config?: EditorConfig) => {
  return [
    ...getBasicExtensions(),
    ...getFormattingExtensions(),
    ...getContentExtensions(config),
    ...getTaskExtensions(),
    ...getEnhancementExtensions(),
  ];
};

// 导出配置类型
export type { EditorConfig };
