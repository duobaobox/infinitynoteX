/**
 * CodeBlockWithToolbar 代码块组件
 * 实现 Notion/GitHub 风格的代码块，工具栏固定在右上角
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Copy, Check, Trash2, ChevronDown } from 'lucide-react';
import './CodeBlockWithToolbar.css';

// 常用编程语言
const LANGUAGES = [
  { value: '', label: '纯文本' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'css', label: 'CSS' },
  { value: 'xml', label: 'HTML' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
];

/**
 * 代码块组件 - 带有固定在右上角的工具栏
 */
export const CodeBlockWithToolbar: React.FC<NodeViewProps> = ({
  node,
  editor,
  getPos,
  updateAttributes,
  deleteNode,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout>();

  const language = node.attrs.language || '';
  const currentLangLabel = LANGUAGES.find((l) => l.value === language)?.label || '纯文本';

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  // 复制代码
  const handleCopy = useCallback(async () => {
    const code = node.textContent;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    const timeoutId = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [node.textContent]);

  // 删除代码块
  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // 设置语言
  const handleLanguageChange = useCallback(
    (lang: string) => {
      // 获取代码块的位置
      const pos = typeof getPos === 'function' ? getPos() : undefined;
      if (typeof pos === 'number' && editor) {
        // 使用 chain 确保所有操作在同一事务中执行
        editor
          .chain()
          .focus()
          .setTextSelection(pos + 1)
          .updateAttributes('codeBlock', { language: lang || null })
          .run();
      } else {
        // 如果无法获取位置，回退到 updateAttributes
        updateAttributes({ language: lang || null });
      }
      setShowDropdown(false);
    },
    [editor, getPos, updateAttributes],
  );

  // 处理下拉菜单失焦
  const handleBlur = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 100);
  }, []);

  return (
    <NodeViewWrapper className="code-block-wrapper">
      {/* 右上角工具栏 */}
      <div className="code-block-toolbar" contentEditable={false}>
        {/* 语言选择下拉菜单 */}
        <div className="language-dropdown">
          <button
            type="button"
            className="language-trigger"
            onClick={() => setShowDropdown(!showDropdown)}
            onBlur={handleBlur}
          >
            <span>{currentLangLabel}</span>
            <ChevronDown size={12} />
          </button>

          {showDropdown && (
            <div className="language-dropdown-menu">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value || 'plain'}
                  type="button"
                  className={`language-option ${language === lang.value ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // 阻止失焦
                    handleLanguageChange(lang.value);
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 复制按钮 */}
        <button
          type="button"
          className={`toolbar-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>

        {/* 删除按钮 */}
        <button
          type="button"
          className="toolbar-btn danger"
          onClick={handleDelete}
          title="删除代码块"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* 代码内容区域 */}
      <pre className="code-block-lowlight">
        <NodeViewContent<'code'> as="code" className="code-content" />
      </pre>
    </NodeViewWrapper>
  );
};

export default CodeBlockWithToolbar;
