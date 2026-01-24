/**
 * 便签颜色常量定义
 * 统一管理便签颜色映射，供多个组件共享使用
 */

// 便签颜色 ID 列表（对应数据库存储的颜色值）
export const NOTE_COLOR_IDS = ['bae0ff', 'd9f7be', 'ffd6e7', 'd6e4ff', 'ffd666', 'ffffff'] as const;

export type NoteColorId = (typeof NOTE_COLOR_IDS)[number];

/**
 * CSS 变量映射（用于组件背景色）
 * 用途：NoteNode 便签节点背景色
 */
export const NOTE_COLOR_CSS_VAR_MAP: Record<NoteColorId, string> = {
  bae0ff: 'var(--note-color-blue)',
  d9f7be: 'var(--note-color-green)',
  ffd6e7: 'var(--note-color-pink)',
  d6e4ff: 'var(--note-color-purple)',
  ffd666: 'var(--note-color-yellow)',
  ffffff: 'var(--note-color-white)',
};

/**
 * 背景色+边框色映射（用于 Tag 等需要边框的场景）
 * 用途：ChatInput 中的便签引用标签
 */
export const NOTE_COLOR_WITH_BORDER_MAP: Record<NoteColorId, { bg: string; border: string }> = {
  bae0ff: {
    bg: 'var(--note-color-blue)',
    border: 'var(--note-color-blue-border)',
  },
  d9f7be: {
    bg: 'var(--note-color-green)',
    border: 'var(--note-color-green-border)',
  },
  ffd6e7: {
    bg: 'var(--note-color-pink)',
    border: 'var(--note-color-pink-border)',
  },
  d6e4ff: {
    bg: 'var(--note-color-purple)',
    border: 'var(--note-color-purple-border)',
  },
  ffd666: {
    bg: 'var(--note-color-yellow)',
    border: 'var(--note-color-yellow-border)',
  },
  ffffff: {
    bg: 'var(--note-color-white)',
    border: 'var(--note-color-white-border)',
  },
};

/**
 * 原始 Hex 颜色映射（用于不支持 CSS 变量的场景）
 * 用途：MiniMap 节点颜色渲染
 */
export const NOTE_COLOR_HEX_MAP: Record<NoteColorId, string> = {
  bae0ff: '#bae0ff',
  d9f7be: '#d9f7be',
  ffd6e7: '#ffd6e7',
  d6e4ff: '#d6e4ff',
  ffd666: '#ffd666',
  ffffff: '#ffffff',
};

/**
 * 默认颜色（白色）
 */
export const DEFAULT_NOTE_COLOR: NoteColorId = 'ffffff';
