/**
 * CodeBlockWithToolbar 代码块组件
 * 普通代码块和 Mermaid 共用同一套卡片骨架，仅在内容区形态上区分
 */

import React, { Suspense, useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Copy, Check, Trash2, ChevronDown, AlertTriangle } from 'lucide-react';
import './CodeBlockWithToolbar.css';
import {
  MERMAID_LANGUAGE,
  validateMermaidSyntax,
  type MermaidValidationResult,
} from '../extensions/mermaid';

const MermaidPreview = React.lazy(async () => {
  const module = await import('@ant-design/x');
  return { default: module.Mermaid };
});

type MermaidView = 'chart' | 'code';

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
  { value: MERMAID_LANGUAGE, label: 'Mermaid' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
];

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
  const isMermaid = language === MERMAID_LANGUAGE;
  const currentLangLabel = LANGUAGES.find((item) => item.value === language)?.label || '纯文本';
  const code = node.textContent;
  const deferredCode = useDeferredValue(code);

  const [mermaidView, setMermaidView] = useState<MermaidView>(
    isMermaid && code.trim().length > 0 ? 'chart' : 'code',
  );
  const [mermaidValidation, setMermaidValidation] = useState<MermaidValidationResult | null>(null);
  const [mermaidRenderableCode, setMermaidRenderableCode] = useState('');

  const mermaidError = mermaidValidation && !mermaidValidation.valid ? mermaidValidation : null;
  const mermaidCanRender = Boolean(
    isMermaid &&
    mermaidValidation?.valid &&
    mermaidRenderableCode.trim().length > 0 &&
    !mermaidError,
  );

  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMermaid) {
      setMermaidView('code');
      setMermaidValidation(null);
      setMermaidRenderableCode('');
      return;
    }

    if (!code.trim()) {
      setMermaidView('code');
    }
  }, [code, isMermaid]);

  useEffect(() => {
    if (!isMermaid) {
      return;
    }

    if (!deferredCode.trim()) {
      setMermaidValidation(null);
      setMermaidRenderableCode('');
      return;
    }

    let cancelled = false;

    void validateMermaidSyntax(deferredCode).then((result) => {
      if (cancelled) return;

      setMermaidValidation(result);

      if (result.valid) {
        setMermaidRenderableCode(deferredCode);
      } else {
        setMermaidRenderableCode('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deferredCode, isMermaid]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    const timeoutId = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeoutId);
  }, [code]);

  const handleDelete = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      const pos = typeof getPos === 'function' ? getPos() : undefined;

      if (typeof pos === 'number' && editor) {
        editor
          .chain()
          .focus()
          .setTextSelection(pos + 1)
          .updateAttributes('codeBlock', { language: lang || null })
          .run();
      } else {
        updateAttributes({ language: lang || null });
      }

      if (lang === MERMAID_LANGUAGE) {
        setMermaidView(code.trim().length > 0 ? 'chart' : 'code');
      } else {
        setMermaidView('code');
      }

      setShowDropdown(false);
    },
    [code, editor, getPos, updateAttributes],
  );

  const handleBlur = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 100);
  }, []);

  const renderLanguageDropdown = () => {
    return (
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
            {LANGUAGES.map((item) => (
              <button
                key={item.value || 'plain'}
                type="button"
                className={`language-option ${language === item.value ? 'active' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleLanguageChange(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <NodeViewWrapper className={`code-block-wrapper ${isMermaid ? 'is-mermaid-block' : ''}`}>
      <div className="code-block-card">
        <div className="code-card-header" contentEditable={false}>
          <div className="code-card-primary">
            {isMermaid ? (
              <div className="code-card-mode-switch">
                <button
                  type="button"
                  className={`code-card-mode-tab ${mermaidView === 'chart' ? 'active' : ''}`}
                  onClick={() => setMermaidView('chart')}
                >
                  图表
                </button>
                <button
                  type="button"
                  className={`code-card-mode-tab ${mermaidView === 'code' ? 'active' : ''}`}
                  onClick={() => setMermaidView('code')}
                >
                  源码
                </button>
              </div>
            ) : (
              <span className="code-card-mode-label">源码</span>
            )}
          </div>

          <div className="code-card-actions">
            {renderLanguageDropdown()}
            <button
              type="button"
              className={`toolbar-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title={copied ? '已复制' : '复制代码'}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <button
              type="button"
              className="toolbar-btn danger"
              onClick={handleDelete}
              title="删除代码块"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="code-card-body">
          {!isMermaid ? (
            <pre className="code-block-lowlight code-card-editor">
              <NodeViewContent<'code'> as="code" className="code-content" />
            </pre>
          ) : mermaidView === 'code' ? (
            <pre className="code-block-lowlight code-card-editor mermaid-code-editor">
              <NodeViewContent<'code'> as="code" className="code-content" />
            </pre>
          ) : (
            <div className="mermaid-preview-surface" contentEditable={false}>
              {!code.trim() ? (
                <div className="mermaid-preview-empty">切换到源码后开始编辑 Mermaid 图表</div>
              ) : mermaidError ? (
                <div className="mermaid-preview-error">
                  <div className="mermaid-preview-error-title">
                    <AlertTriangle size={14} />
                    <span>{mermaidError.message}</span>
                  </div>
                  <div className="mermaid-preview-error-hint">{mermaidError.hint}</div>
                  {mermaidError.detail ? (
                    <details className="mermaid-preview-error-details">
                      <summary>查看解析详情</summary>
                      <pre className="mermaid-preview-error-detail-text">{mermaidError.detail}</pre>
                    </details>
                  ) : null}
                </div>
              ) : mermaidCanRender ? (
                <Suspense fallback={<div className="mermaid-preview-empty">Mermaid 渲染中...</div>}>
                  <MermaidPreview
                    header={null}
                    classNames={{
                      root: 'mermaid-preview-root',
                      graph: 'mermaid-preview-graph',
                    }}
                    styles={{
                      root: {
                        background: 'transparent',
                      },
                      graph: {
                        height: '350px',
                        minHeight: '350px',
                        padding: 0,
                        border: 'none',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        background: 'transparent',
                      },
                    }}
                  >
                    {mermaidRenderableCode}
                  </MermaidPreview>
                </Suspense>
              ) : (
                <div className="mermaid-preview-empty">正在检查 Mermaid 语法...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export default CodeBlockWithToolbar;
