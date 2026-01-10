/**
 * IPC Handlers - Barrel Export
 * IPC 处理器统一入口
 */

import { registerLogHandlers } from './logHandlers';
import { registerStorageHandlers } from './storageHandlers';
import { registerSyncHandlers } from './syncHandlers';
import { registerAIHandlers } from './aiHandlers';
import { registerConfigHandlers } from './configHandlers';
import { registerKnowledgeHandlers } from './knowledgeHandlers';

export { registerLogHandlers } from './logHandlers';
export { registerStorageHandlers } from './storageHandlers';
export { registerSyncHandlers } from './syncHandlers';
export { registerAIHandlers } from './aiHandlers';
export { registerConfigHandlers } from './configHandlers';
export { registerKnowledgeHandlers } from './knowledgeHandlers';

/**
 * 注册所有 IPC 处理器
 */
export function registerAllIpcHandlers(): void {
  registerLogHandlers();
  registerStorageHandlers();
  registerSyncHandlers();
  registerAIHandlers();
  registerConfigHandlers();
  registerKnowledgeHandlers();
}
