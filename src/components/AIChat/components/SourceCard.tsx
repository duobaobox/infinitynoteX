/**
 * SourceCard - 知识库来源引用卡片组件
 * 展示 AI 回答引用的笔记来源
 */

import React from 'react';
import { Typography, Tooltip } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { KnowledgeSource } from '../types';

const { Text } = Typography;

interface SourceCardProps {
  sources: KnowledgeSource[];
  onSourceClick?: (noteId: string) => void;
}

/**
 * 来源引用卡片组件
 */
export const SourceCard: React.FC<SourceCardProps> = ({ sources, onSourceClick }) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="source-card">
      <div className="source-card__header">
        <FileTextOutlined style={{ marginRight: 6 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          参考来源 ({sources.length})
        </Text>
      </div>
      <div className="source-card__list">
        {sources.map((source, index) => (
          <Tooltip
            key={source.noteId + index}
            title={source.excerpt}
            placement="top"
            styles={{ root: { maxWidth: 400 } }}
          >
            <div
              className="source-card__item"
              onClick={() => onSourceClick?.(source.noteId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSourceClick?.(source.noteId);
              }}
            >
              <span className="source-card__item-index">{index + 1}</span>
              <span className="source-card__item-title">{source.noteTitle}</span>
              <span className="source-card__item-score">{Math.round(source.score * 100)}%</span>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default SourceCard;
