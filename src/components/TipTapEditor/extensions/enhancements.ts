/**
 * 增强扩展配置
 * 包含 CharacterCount、Typography、SlashCommands 等功能增强扩展
 */

import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import { SlashCommands, getFlatCommands, type CommandItem } from './SlashCommands';
import { createSuggestionRenderer } from '../menus/SlashCommandMenu/suggestion';

/**
 * 获取增强扩展
 * - CharacterCount: 字符/单词计数
 * - Typography: 自动排版优化（智能引号、破折号等）
 * - SlashCommands: 斜杠命令菜单（类似 Notion）
 */
export const getEnhancementExtensions = () => {
  return [
    // 字符计数扩展
    CharacterCount.configure({
      limit: null, // 不限制字符数，如需限制可设置数字如 10000
      mode: 'textSize', // 计算纯文本大小（还可用 'nodeSize'）
    }),

    // 排版优化扩展
    // 自动将一些输入转换为更专业的排版形式
    // 注意：配置值需要是替换后的字符串，或 false 表示禁用
    Typography.configure({
      // 三个点 ... → 省略号 …
      ellipsis: '\u2026',
      // 两个破折号 -- → 长破折号 —
      emDash: '\u2014',
      // 版权符号 (c) → ©
      copyright: '\u00A9',
      // 注册商标 (r) → ®
      registeredTrademark: '\u00AE',
      // 商标 (tm) → ™
      trademark: '\u2122',
      // 服务标记 (sm) → ℠ (默认关闭)
      servicemark: false,
      // 1/2 → ½
      oneHalf: '\u00BD',
      // 1/4 → ¼
      oneQuarter: '\u00BC',
      // 3/4 → ¾
      threeQuarters: '\u00BE',
      // +- → ±
      plusMinus: '\u00B1',
      // != → ≠
      notEqual: '\u2260',
      // 乘号 x → × (默认关闭，避免影响正常输入)
      multiplication: false,
    }),

    // 斜杠命令扩展（类似 Notion 的 "/" 命令菜单）
    SlashCommands.configure({
      suggestion: {
        char: '/',
        startOfLine: false,
        items: ({ query }: { query: string }): CommandItem[] => {
          const commands = getFlatCommands();
          if (!query) return commands;
          const lowerQuery = query.toLowerCase();
          return commands.filter(
            (cmd) =>
              cmd.title.toLowerCase().includes(lowerQuery) ||
              cmd.description.toLowerCase().includes(lowerQuery),
          );
        },
        render: createSuggestionRenderer,
      },
    }),
  ];
};
