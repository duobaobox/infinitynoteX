/**
 * Message Converter 单元测试
 * 验证 store Message 和 UI ChatItem 的转换契约
 */

import type { Message } from '../../../store/slices/aiConversationSlice';
import type { ChatItem } from '../types';
import {
  buildChatItems,
  chatItemToMessage,
  messageToChatItem,
  messagesToChatItems,
} from '../utils/messageConverter';

describe('Message Converter - Format Conversion Tests', () => {
  it('should convert assistant messages with reasoning into <think> chat items', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: '最终回答',
      reasoning: '思考过程',
      timestamp: 1,
    };

    const chatItem = messageToChatItem(message);

    expect(chatItem).toEqual({
      key: 'msg-1',
      role: 'ai',
      content: '<think>思考过程</think>\n最终回答',
      timestamp: 1,
      references: undefined,
      ragSources: undefined,
      toolApprovals: undefined,
      runTrace: undefined,
    });
  });

  it('should keep user messages unchanged when converting to chat items', () => {
    const message: Message = {
      id: 'msg-2',
      role: 'user',
      content: '你好',
      timestamp: 2,
    };

    const chatItem = messageToChatItem(message);
    expect(chatItem.role).toBe('user');
    expect(chatItem.content).toBe('你好');
  });

  it('should split think tags back into reasoning and visible content', () => {
    const chatItem: ChatItem = {
      key: 'msg-3',
      role: 'ai',
      content: '<think>推理细节</think>\n答案正文',
      timestamp: 3,
    };

    const message = chatItemToMessage(chatItem);

    expect(message).toEqual({
      id: 'msg-3',
      role: 'assistant',
      content: '答案正文',
      reasoning: '推理细节',
      timestamp: 3,
      references: undefined,
      ragSources: undefined,
      toolApprovals: undefined,
      runTrace: undefined,
    });
  });

  it('should expose list helpers for deriving chat items from store messages', () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', content: 'Q', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'A', reasoning: 'R', timestamp: 2 },
    ];

    expect(messagesToChatItems(messages)).toEqual(buildChatItems(messages));
    expect(buildChatItems(messages).map((item) => item.key)).toEqual(['u1', 'a1']);
  });
});
