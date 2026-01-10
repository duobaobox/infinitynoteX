/**
 * CharacterCount 字符计数组件
 * 显示当前文档的字符数和单词数
 */

import React from 'react';
import type { Editor } from '@tiptap/react';
import './CharacterCount.css';

interface CharacterCountProps {
  editor: Editor | null;
  /** 字符限制 (可选) */
  limit?: number;
  /** 是否显示单词数 */
  showWords?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 字符计数组件
 * 显示字符数、单词数，可选显示限制进度
 */
export const CharacterCount: React.FC<CharacterCountProps> = ({
  editor,
  limit,
  showWords = true,
  className = '',
}) => {
  if (!editor) {
    return null;
  }

  // 获取字符计数存储
  const storage = editor.storage.characterCount;
  const characters = storage?.characters?.() ?? 0;
  const words = storage?.words?.() ?? 0;

  // 计算百分比 (如果有限制)
  const percentage = limit ? Math.round((characters / limit) * 100) : null;
  const isNearLimit = percentage !== null && percentage >= 80;
  const isOverLimit = percentage !== null && percentage >= 100;

  return (
    <div className={`character-count ${className}`}>
      <span className={`count ${isOverLimit ? 'over-limit' : isNearLimit ? 'near-limit' : ''}`}>
        {characters}
        {limit && ` / ${limit}`} 字符
      </span>
      {showWords && (
        <>
          <span className="separator">·</span>
          <span className="count">{words} 词</span>
        </>
      )}
    </div>
  );
};

export default CharacterCount;
