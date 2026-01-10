/**
 * TipTap Editor 导出文件
 * 按照模块化规范导出所有公共接口
 */

export { default as TipTapEditor } from './core/TipTapEditor';
export { MenuBar } from './menus/MenuBar';
export { getExtensions } from './extensions';
export type { TipTapEditorProps, MenuBarProps } from './types';
