import React, { useRef } from 'react';
import { Sender, Suggestion } from '@ant-design/x';
import { Tag, message, Flex, Tooltip, MenuProps } from 'antd';
import {
  FileTextOutlined,
  BookOutlined,
  TranslationOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { GetRef } from 'antd';
import { ProviderSwitcher } from './ProviderSwitcher';
import { NoteReference } from './NoteReference';
import type { NoteReference as NoteReferenceType, ProviderOption } from '../types';
import { truncateTitle } from '../utils';

// 快捷指令配置
const QUICK_COMMANDS = [
  {
    label: '摘要总结',
    value: 'summarize',
    icon: <FileTextOutlined />,
  },
  {
    label: '翻译',
    value: 'translate',
    icon: <TranslationOutlined />,
    children: [
      { label: '翻译成中文', value: 'translate_zh' },
      { label: '翻译成英文', value: 'translate_en' },
      { label: '翻译成日文', value: 'translate_ja' },
    ],
  },
  {
    label: '改写优化',
    value: 'rewrite',
    icon: <EditOutlined />,
    children: [
      { label: '语气更正式', value: 'rewrite_formal' },
      { label: '语气更口语化', value: 'rewrite_casual' },
      { label: '精简压缩', value: 'rewrite_concise' },
    ],
  },
  {
    label: '灵感建议',
    value: 'inspire',
    icon: <BookOutlined />,
  },
];

// 便签颜色映射表 - 使用 CSS 变量以支持暗色模式
const NOTE_COLOR_MAP: Record<string, { bg: string; border: string }> = {
  bae0ff: { bg: 'var(--note-color-blue)', border: 'var(--note-color-blue-border)' },
  d9f7be: { bg: 'var(--note-color-green)', border: 'var(--note-color-green-border)' },
  ffd6e7: { bg: 'var(--note-color-pink)', border: 'var(--note-color-pink-border)' },
  d6e4ff: { bg: 'var(--note-color-purple)', border: 'var(--note-color-purple-border)' },
  ffd666: { bg: 'var(--note-color-yellow)', border: 'var(--note-color-yellow-border)' },
  ffffff: { bg: 'var(--note-color-white)', border: 'var(--note-color-white-border)' },
};

interface ChatInputProps {
  isLoading: boolean;
  onSend: (value: string, attachments?: NoteReferenceType[]) => void;
  onAbort: () => void;
  selectedNotes: Array<{ id: string; title: string; content: string; color?: string }>;
  onRemoveNote: (id: string) => void;
  providerConfig: {
    config: { model: string } | null;
    options: ProviderOption[];
    currentId: string;
    isSwitching: boolean;
    onSwitch: (key: string) => void;
  };
  knowledgeBase: {
    enabled: boolean;
    inUse: boolean;
    onToggle: (val: boolean) => void;
  };
  noteReference: {
    items: MenuProps['items'];
    onSelect: MenuProps['onClick'];
  };
  autoSize?: { minRows: number; maxRows: number };
}

export const ChatInput: React.FC<ChatInputProps> = ({
  isLoading,
  onSend,
  onAbort,
  selectedNotes,
  onRemoveNote,
  providerConfig,
  knowledgeBase,
  noteReference,
  autoSize = { minRows: 2, maxRows: 6 },
}) => {
  const senderRef = useRef<GetRef<typeof Sender>>(null);

  return (
    <>
      {/* 已选便签展示 */}
      {selectedNotes.length > 0 && (
        <div className="ai-chat-selected-notes">
          {selectedNotes.map((note) => {
            const colors = note.color ? NOTE_COLOR_MAP[note.color] : undefined;

            return (
              <Tag
                key={note.id}
                closable
                onClose={() => onRemoveNote(note.id)}
                icon={<FileTextOutlined />}
                style={
                  colors
                    ? {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                        color: 'var(--note-color-text)',
                      }
                    : undefined
                }
              >
                <span className="ai-chat-note-tag-text">{truncateTitle(note.title)}</span>
              </Tag>
            );
          })}
        </div>
      )}

      {/* 输入框 */}
      <div className="ai-chat-input">
        <Suggestion
          items={QUICK_COMMANDS}
          onSelect={(value) => {
            message.info(`快捷指令"${value}"即将推出`);
          }}
        >
          {({ onTrigger, onKeyDown: suggestionKeyDown }) => (
            <Sender
              ref={senderRef}
              loading={isLoading}
              placeholder="输入消息"
              onKeyDown={(e) => {
                // 监听 @ 键唤起快捷指令
                if (e.key === '@') {
                  onTrigger();
                } else {
                  onTrigger(false);
                }
                // 传递给 Suggestion 的 onKeyDown
                suggestionKeyDown?.(e);
              }}
              onSubmit={(value) => {
                if (value.trim()) {
                  // 将 selectedNotes 转换为 NoteReference 格式
                  const references = selectedNotes.map((note) => ({
                    id: note.id,
                    title: note.title,
                    byteLength: new TextEncoder().encode(note.content).length,
                    content: note.content,
                  }));

                  // 构建便签上下文（作为隐藏上下文发送给 AI）
                  let noteContext = '';
                  if (selectedNotes.length > 0) {
                    noteContext = '\n\n以下是用户引用的便签内容，请结合这些内容回答：\n\n';
                    selectedNotes.forEach((note, i) => {
                      noteContext += `[引用 ${i + 1}: ${note.title}]\n${note.content}\n\n`;
                    });
                  }

                  onSend(value + noteContext, references.length > 0 ? references : undefined);
                  senderRef.current?.clear?.();
                }
              }}
              onCancel={() => {
                // 取消按钮 = 中止当前流式请求
                if (isLoading) {
                  onAbort();
                }
                senderRef.current?.clear?.();
                message.info(isLoading ? '已中止生成' : '已取消发送');
              }}
              footer={(_, { components }) => {
                const { SendButton, LoadingButton } = components;

                return (
                  <Flex justify="space-between" align="center">
                    <Flex gap="small" align="center">
                      {/* AI Provider 切换器 */}
                      <ProviderSwitcher
                        config={providerConfig.config}
                        providerOptions={providerConfig.options}
                        currentProviderId={providerConfig.currentId}
                        isSwitching={providerConfig.isSwitching}
                        onSwitch={providerConfig.onSwitch}
                      />

                      {/* 便签引用 */}
                      <NoteReference
                        noteItems={noteReference.items}
                        onSelect={noteReference.onSelect}
                        selectedKeys={selectedNotes.map((n) => n.id)}
                      />

                      {/* 知识库开关 */}
                      {knowledgeBase.enabled && (
                        <Tooltip
                          title={knowledgeBase.inUse ? '已开启知识库增强' : '点击开启知识库问答'}
                        >
                          <span
                            className={`ai-icon-btn ${knowledgeBase.inUse ? 'ai-icon-btn--active' : ''}`}
                            onClick={() => knowledgeBase.onToggle(!knowledgeBase.inUse)}
                          >
                            <BookOutlined style={{ fontSize: 14 }} />
                          </span>
                        </Tooltip>
                      )}
                    </Flex>
                    <Flex align="center">
                      {isLoading ? <LoadingButton /> : <SendButton type="primary" />}
                    </Flex>
                  </Flex>
                );
              }}
              suffix={false}
              autoSize={autoSize}
            />
          )}
        </Suggestion>
      </div>
    </>
  );
};
