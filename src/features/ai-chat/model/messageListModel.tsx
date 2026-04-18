import { Bubble, Actions } from '@ant-design/x';
import { Avatar } from 'antd';
import { CopyOutlined, RobotOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import type { GetProp } from 'antd';

import type { ChatItem } from '../types';
import { stripThinkBlocks } from '../../../shared/utils/tiptapMarkdown';
import { ChatMessageContent } from '../components/ChatMessageContent';
import { ToolThoughtChain } from '../components/ToolThoughtChain';

type BubbleListItem = NonNullable<GetProp<typeof Bubble.List, 'items'>>[number];

interface BuildBubbleItemsArgs {
  items: ChatItem[];
  copiedBubbleKey: string | null;
  onCopyAnswer: (item: ChatItem) => void;
  onSaveToNote: (content: string) => void;
  onRespondToolApproval: (approvalId: string, approved: boolean) => void;
}

export function buildBubbleItems(args: BuildBubbleItemsArgs): BubbleListItem[] {
  const { items, copiedBubbleKey, onCopyAnswer, onSaveToNote, onRespondToolApproval } = args;

  return items.map((item) => {
    const isCopied = copiedBubbleKey === item.key;
    const aiExportedContent =
      item.role === 'ai' ? stripThinkBlocks(item.content || '') : item.content;
    const hasCopyableAiText = item.role === 'ai' && aiExportedContent.trim().length > 0;

    const bubbleItem: BubbleListItem = {
      key: item.key,
      role: item.role,
      content: item.content,
      placement: item.role === 'ai' ? 'start' : 'end',
      contentRender: () => {
        const hasMarkdown =
          item.role === 'ai' &&
          item.content.trim().length > 0 &&
          stripThinkBlocks(item.content).trim().length > 0;

        return (
          <>
            {item.role === 'ai' ? (
              <ToolThoughtChain
                item={item}
                onRespondToolApproval={onRespondToolApproval}
                withBottomSpacing={hasMarkdown}
              />
            ) : null}
            <ChatMessageContent item={item} />
          </>
        );
      },
      avatar:
        item.role === 'ai' ? (
          <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
        ) : (
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a' }} />
        ),
    };

    if (item.role === 'user') {
      bubbleItem.status = 'local';
    } else {
      bubbleItem.status = item.isStreaming
        ? item.content.trim() || item.toolDrafts?.length || item.toolApprovals?.length
          ? 'updating'
          : 'loading'
        : 'success';
      bubbleItem.streaming = Boolean(item.isStreaming);
    }

    if (
      item.role === 'ai' &&
      !item.content.trim() &&
      item.isStreaming &&
      !(item.toolDrafts?.length || item.toolApprovals?.length)
    ) {
      bubbleItem.loading = true;
    } else if (item.role === 'ai' && item.isStreaming && item.content.trim()) {
      bubbleItem.typing = { effect: 'typing', step: 5, interval: 50 };
    }

    if (hasCopyableAiText) {
      bubbleItem.footer = () => (
        <Actions
          items={[
            {
              key: 'copy',
              icon: <CopyOutlined />,
              label: isCopied ? '已复制' : '复制',
            },
            {
              key: 'save',
              icon: <SaveOutlined />,
              label: '保存到便签',
            },
          ]}
          onClick={({ key }) => {
            if (key === 'copy') {
              onCopyAnswer(item);
            } else if (key === 'save') {
              onSaveToNote(aiExportedContent);
            }
          }}
        />
      );
      bubbleItem.footerPlacement = 'outer-end';
    }

    return bubbleItem;
  });
}
