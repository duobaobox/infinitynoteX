/**
 * CodeBlockBubbleMenu 代码块菜单
 * 光标在代码块内时显示的操作工具栏
 */

import React from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { Copy, Trash2, Check } from 'lucide-react';
import { useEditorState } from '../../hooks';
import './BubbleMenu.css';

interface CodeBlockBubbleMenuProps {
  editor: Editor;
}

// 常用编程语言
const LANGUAGES = [
  { value: null, label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
];

/**
 * 代码块菜单 - 光标在代码块内时显示
 */
export const CodeBlockBubbleMenu: React.FC<CodeBlockBubbleMenuProps> = ({ editor }) => {
  const [copied, setCopied] = React.useState(false);

  // 订阅编辑器状态变化，确保光标移动到不同代码块时组件重新渲染
  useEditorState(editor);

  if (!editor) {
    return null;
  }

  // 获取当前语言
  const currentLanguage = editor.getAttributes('codeBlock').language || null;

  // 设置语言
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value || null;
    editor.chain().focus().updateAttributes('codeBlock', { language: lang }).run();
  };

  // 复制代码
  const handleCopy = async () => {
    // 获取代码块内容
    const { state } = editor;
    const { from } = state.selection;
    const node = state.doc.nodeAt(from);

    if (node?.type.name === 'codeBlock') {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 删除代码块
  const handleDelete = () => {
    editor.chain().focus().deleteNode('codeBlock').run();
  };

  return (
    <BubbleMenu
      className="bubble-menu codeblock-bubble-menu"
      editor={editor}
      options={{
        placement: 'top-start',
      }}
      shouldShow={({ editor: e }) => e.isActive('codeBlock')}
    >
      {/* 语言选择 */}
      <select
        className="language-select"
        value={currentLanguage || ''}
        onChange={handleLanguageChange}
        title="选择语言"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value || 'plain'} value={lang.value || ''}>
            {lang.label}
          </option>
        ))}
      </select>

      <span className="divider" />

      {/* 复制代码 */}
      <button
        type="button"
        onClick={handleCopy}
        className={copied ? 'is-active' : ''}
        title={copied ? '已复制' : '复制代码'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>

      {/* 删除代码块 */}
      <button type="button" onClick={handleDelete} className="danger" title="删除代码块">
        <Trash2 size={14} />
      </button>
    </BubbleMenu>
  );
};

export default CodeBlockBubbleMenu;
