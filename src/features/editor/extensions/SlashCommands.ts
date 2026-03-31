/**
 * SlashCommands 斜杠命令扩展
 * 输入 "/" 时弹出命令菜单（类似 Notion）
 *
 * @see https://tiptap.dev/docs/editor/extensions/functionality/suggestion
 */

import { Extension, type Range as TiptapRange } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import type { Editor } from '@tiptap/react';
import { createMermaidCodeBlock, DEFAULT_MERMAID_TEMPLATE } from './mermaid';

/**
 * 命令项类型
 */
export interface CommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: TiptapRange }) => void;
}

/**
 * 命令分组
 */
export interface CommandGroup {
  title: string;
  commands: CommandItem[];
}

/**
 * 获取所有命令
 */
export const getSlashCommands = (): CommandGroup[] => [
  {
    title: '基础',
    commands: [
      {
        title: '标题 1',
        description: '大标题',
        icon: 'H1',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
        },
      },
      {
        title: '标题 2',
        description: '中标题',
        icon: 'H2',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
        },
      },
      {
        title: '标题 3',
        description: '小标题',
        icon: 'H3',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
        },
      },
      {
        title: '段落',
        description: '普通文本',
        icon: 'P',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('paragraph').run();
        },
      },
    ],
  },
  {
    title: '列表',
    commands: [
      {
        title: '无序列表',
        description: '创建无序列表',
        icon: '•',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: '有序列表',
        description: '创建编号列表',
        icon: '1.',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: '任务列表',
        description: '创建待办列表',
        icon: '☑',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
      },
    ],
  },
  {
    title: '块元素',
    commands: [
      {
        title: '引用',
        description: '创建引用块',
        icon: '"',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: '代码块',
        description: '创建代码块',
        icon: '</>',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: '分割线',
        description: '插入水平分割线',
        icon: '—',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
    ],
  },
  {
    title: '插入',
    commands: [
      {
        title: 'Mermaid 图表',
        description: '插入可预览的 Mermaid 图表',
        icon: 'MMD',
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(createMermaidCodeBlock(DEFAULT_MERMAID_TEMPLATE))
            .run();
        },
      },
      {
        title: '表格',
        description: '插入 3x3 表格',
        icon: '⊞',
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      },
    ],
  },
];

/**
 * 扁平化命令列表用于搜索
 */
export const getFlatCommands = (): CommandItem[] => {
  return getSlashCommands().flatMap((group) => group.commands);
};

/**
 * 根据查询过滤命令
 */
export const filterCommands = (query: string): CommandItem[] => {
  const commands = getFlatCommands();
  if (!query) return commands;

  const lowerQuery = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery),
  );
};

/**
 * SlashCommands 扩展配置类型
 */
export type SlashCommandsOptions = {
  suggestion: Omit<SuggestionOptions, 'editor'>;
};

/**
 * SlashCommands 扩展
 * 使用 Suggestion 扩展实现 "/" 命令菜单
 */
export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommands;
