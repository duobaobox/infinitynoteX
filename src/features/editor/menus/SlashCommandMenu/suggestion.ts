/**
 * SlashCommands Suggestion 渲染函数
 * 使用 React 渲染 Suggestion 弹出菜单
 */

import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { SlashCommandMenu, type SlashCommandMenuRef } from './index';
import type { CommandItem } from '../../extensions/SlashCommands';
import { getFlatCommands } from '../../extensions/SlashCommands';

interface RenderState {
  component: ReactRenderer<SlashCommandMenuRef>;
  popup: TippyInstance;
}

/**
 * 创建 Suggestion 渲染函数
 * 符合 TipTap Suggestion render() 的类型签名
 */
export const createSuggestionRenderer = () => {
  let state: RenderState | null = null;

  return {
    onStart: (props: SuggestionProps<CommandItem>) => {
      const component = new ReactRenderer(SlashCommandMenu, {
        props: {
          items: getFlatCommands(),
          command: props.command,
          query: props.query,
        },
        editor: props.editor,
      });

      const popup = tippy('body', {
        getReferenceClientRect: props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        animation: 'shift-away',
        duration: [200, 150],
      });

      state = { component, popup: popup[0] };
    },

    onUpdate: (props: SuggestionProps<CommandItem>) => {
      if (!state) return;

      state.component.updateProps({
        items: getFlatCommands(),
        command: props.command,
        query: props.query,
      });

      if (props.clientRect) {
        state.popup.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      }
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (!state) return false;

      if (props.event.key === 'Escape') {
        state.popup.hide();
        return true;
      }

      return state.component.ref?.onKeyDown(props) ?? false;
    },

    onExit: () => {
      if (!state) return;
      state.popup.destroy();
      state.component.destroy();
      state = null;
    },
  };
};

export default createSuggestionRenderer;
