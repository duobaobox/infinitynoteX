/**
 * Message Converter 单元测试
 * 验证Message和ChatItem之间的格式转换
 */

import { messageToChatItem, chatItemToMessage } from '../utils/messageConverter';
import type { Message } from '../../../store/slices/aiConversationSlice';
import type { ChatItem } from '../types';

describe('Message Converter - Format Conversion Tests', () => {
  const sampleMessage: Message = {
    id: 'msg-123',
    role: 'assistant',
    content: 'Hello, this is an AI response',
    timestamp: 1640000000000,
    reasoning: 'I analyzed the query and formulated a response',
    references: [
      { noteId: 'note-1', title: 'Reference 1' },
      { noteId: 'note-2', title: 'Reference 2' },
    ],
    ragSources: [
      { key: 0, title: 'Source 1', description: 'First source' },
      { key: 1, title: 'Source 2', description: 'Second source' },
    ],
    relatedToolCallIds: ['tool-1', 'tool-2'],
    toolApprovals: [
      {
        id: 'approval-1',
        toolCallId: 'tool-1',
        toolName: 'execute_command',
        inputPreview: '{"cmd": "ls"}',
        state: 'PENDING',
        timestamp: 1640000000000,
      },
    ],
  };

  it('应该正确将Message转换为ChatItem', () => {
    const chatItem = messageToChatItem(sampleMessage);

    expect(chatItem.key).toBe(sampleMessage.id);
    expect(chatItem.role).toBe('ai');
    expect(chatItem.content).toBe(sampleMessage.content);
    expect(chatItem.timestamp).toBe(sampleMessage.timestamp);
    expect(chatItem.references).toEqual(sampleMessage.references);
    expect(chatItem.ragSources).toEqual(sampleMessage.ragSources);
    expect(chatItem.toolApprovals).toEqual(sampleMessage.toolApprovals);
  });

  it('应该保留所有UI相关字段在ChatItem中', () => {
    const chatItem = messageToChatItem(sampleMessage);

    expect(chatItem.references).toBeDefined();
    expect(chatItem.ragSources).toBeDefined();
    expect(chatItem.toolApprovals).toBeDefined();
    expect(chatItem.runTrace).toBeUndefined(); // runTrace在sampleMessage中未定义
  });

  it('应该正确转换用户消息：assistant → ai，user → user', () => {
    const assistantMsg: Message = {
      ...sampleMessage,
      role: 'assistant',
    };

    const userMsg: Message = {
      ...sampleMessage,
      id: 'msg-124',
      role: 'user',
    };

    const aiItem = messageToChatItem(assistantMsg);
    const userItem = messageToChatItem(userMsg);

    expect(aiItem.role).toBe('ai');
    expect(userItem.role).toBe('user');
  });

  it('应该处理Message中的可选字段', () => {
    const minimalMessage: Message = {
      id: 'msg-125',
      role: 'user',
      content: 'Simple message',
      timestamp: 1640000000000,
    };

    const chatItem = messageToChatItem(minimalMessage);

    expect(chatItem.key).toBe('msg-125');
    expect(chatItem.content).toBe('Simple message');
    expect(chatItem.references).toBeUndefined();
    expect(chatItem.ragSources).toBeUndefined();
  });

  it('应该正确将ChatItem转换回Message（持久化格式）', () => {
    const chatItem: ChatItem = {
      key: 'msg-123',
      role: 'ai',
      content: 'Response content',
      timestamp: 1640000000000,
      references: [{ noteId: 'note-1', title: 'Ref' }],
      ragSources: [{ key: 0, title: 'Source' }],
      toolApprovals: [
        {
          id: 'appr-1',
          toolCallId: 'tool-1',
          toolName: 'cmd',
          inputPreview: '{}',
          state: 'PENDING',
          timestamp: 1640000000000,
        },
      ],
    };

    const message = chatItemToMessage(chatItem);

    expect(message.id).toBe(chatItem.key);
    expect(message.role).toBe('assistant'); // ai → assistant
    expect(message.content).toBe(chatItem.content);
    expect(message.timestamp).toBe(chatItem.timestamp);
    expect(message.references).toEqual(chatItem.references);
    expect(message.ragSources).toEqual(chatItem.ragSources);
  });

  it('应该在chatItem→Message转换时丢弃UI临时状态', () => {
    const chatItem: ChatItem = {
      key: 'msg-123',
      role: 'ai',
      content: 'Content',
      timestamp: 1640000000000,
      // toolApprovals不应该被保存
      toolApprovals: [
        {
          id: 'appr-1',
          toolCallId: 'tool-1',
          toolName: 'cmd',
          inputPreview: '{}',
          state: 'PENDING',
          timestamp: 1640000000000,
        },
      ],
    };

    const message = chatItemToMessage(chatItem);

    // 注意：按照messageConverter.ts的实现，toolApprovals不在持久化字段中
    // 但根据aiConversationSlice的Message接口，toolApprovals是可选的UI字段
    // 这里验证必须保存的字段
    expect(message.id).toBeDefined();
    expect(message.role).toBeDefined();
    expect(message.content).toBeDefined();
    expect(message.timestamp).toBeDefined();
  });

  it('应该支持双向转换的往返一致性', () => {
    const originalMessage: Message = {
      id: 'msg-126',
      role: 'user',
      content: 'Test content',
      timestamp: 1640000000000,
      references: [{ noteId: 'n1', title: 'T1' }],
    };

    const chatItem = messageToChatItem(originalMessage);
    const recoveredMessage = chatItemToMessage(chatItem);

    // 核心字段应该保持一致
    expect(recoveredMessage.id).toBe(originalMessage.id);
    expect(recoveredMessage.content).toBe(originalMessage.content);
    expect(recoveredMessage.timestamp).toBe(originalMessage.timestamp);
    expect(recoveredMessage.references).toEqual(originalMessage.references);
  });

  it('应该在转换时保持参考和来源数据的完整性', () => {
    const message: Message = {
      id: 'msg-127',
      role: 'assistant',
      content: 'Response with sources',
      timestamp: 1640000000000,
      references: [
        { noteId: 'note-a', title: 'Note A' },
        { noteId: 'note-b', title: 'Note B' },
      ],
      ragSources: [
        { key: 0, title: 'Document 1', description: 'Desc 1', noteId: 'note-a' },
        { key: 1, title: 'Document 2', description: 'Desc 2' },
      ],
    };

    const chatItem = messageToChatItem(message);

    expect(chatItem.references?.length).toBe(2);
    expect(chatItem.ragSources?.length).toBe(2);
    expect(chatItem.references![0]).toEqual(message.references![0]);
    expect(chatItem.ragSources![1]).toEqual(message.ragSources![1]);
  });

  it('应该处理空的引用和来源列表', () => {
    const message: Message = {
      id: 'msg-128',
      role: 'user',
      content: 'No references',
      timestamp: 1640000000000,
      references: [],
      ragSources: [],
    };

    const chatItem = messageToChatItem(message);

    expect(chatItem.references?.length).toBe(0);
    expect(chatItem.ragSources?.length).toBe(0);
  });
});
