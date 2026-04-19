/**
 * Message Converter Utilities
 *
 * 转换Message（Store格式）和ChatItem（UI格式）之间的数据
 */

import type { Message } from '../../../store/slices/aiConversationSlice';
import type { ChatItem } from '../types';

/**
 * 将Message转换为ChatItem（UI显示格式）
 *
 * ChatItem是为Ant Design X组件优化的格式，
 * 包含UI所需的所有信息（toolApprovals, toolDrafts等）
 */
export function messageToChatItem(message: Message): ChatItem {
  return {
    key: message.id,
    role: message.role === 'assistant' ? 'ai' : 'user',
    content: message.content,
    timestamp: message.timestamp,
    references: message.references,
    ragSources: message.ragSources,
    toolApprovals: message.toolApprovals,
    runTrace: message.runTrace,
    // 注意：toolDrafts不存储在Message中，而是存储在ToolCallSlice中
    // 需要从ToolCallSlice单独获取并merge
  };
}

/**
 * 将ChatItem转换回Message（Store格式）
 *
 * 只保存必要的持久化数据，丢弃UI临时状态
 */
export function chatItemToMessage(item: ChatItem): Message {
  return {
    id: item.key,
    role: item.role === 'ai' ? 'assistant' : 'user',
    content: item.content,
    timestamp: item.timestamp,
    references: item.references,
    ragSources: item.ragSources,
    // 以下字段不持久化，只在内存中保留
    // toolApprovals不持久化
    // runTrace不持久化
  };
}

/**
 * 合并ChatItem列表，确保每个message有正确的UI数据
 *
 * 用于在从Store读取Message后，补充来自ToolCallSlice和其他地方的UI数据
 */
export function mergeChatItemsWithToolData(items: ChatItem[]): ChatItem[] {
  return items.map((item) => {
    // 如果需要，可以在这里合并toolDrafts等
    return item;
  });
}
