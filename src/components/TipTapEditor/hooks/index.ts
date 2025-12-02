/**
 * TipTap Editor Hooks
 * 统一导出所有自定义 Hooks
 */

export { useEditorState, useEditorUpdate } from './useEditorState';
export {
  useMenuState,
  useHeadingState,
  useListState,
  useAlignState,
  useTableState,
} from './useMenuState';
export { useImageUpload } from './useImageUpload';
export type { MenuTriggerState } from './useMenuState';
