/**
 * Store Slices - 统一导出所有 slices
 */

export { createUISlice, type UISlice } from './uiSlice';
export { createFolderSlice, type FolderSlice } from './folderSlice';
export { createNoteSlice, type NoteSlice } from './noteSlice';
export {
  createAIConversationSlice,
  type AIConversationSlice,
  type Message,
} from './aiConversationSlice';
export { createBrowserCardsSlice, type BrowserCardsSlice } from './browserCardsSlice';
export { createTodoSlice, type TodoSlice } from './todoSlice';
export {
  createWorkspaceViewSlice,
  type WorkspaceViewSlice,
  type WorkspaceView,
} from './workspaceViewSlice';

// AI Chat 状态机 slices (NEW)
export {
  createRequestSlice,
  type RequestSlice,
  type RequestState,
  type Request,
} from './requestSlice';
export {
  createToolCallSlice,
  type ToolCallSlice,
  type ToolCallStateType,
  type ToolCall,
} from './toolCallSlice';
export {
  createRetrievalSlice,
  type RetrievalSlice,
  type RetrievalContext,
  type RetrievalStrategy,
} from './retrievalSlice';

// Settings 相关 slices
export { createAppearanceSlice, type AppearanceSlice } from './appearanceSlice';
export {
  createAIConfigSlice,
  type AIConfigSlice,
  type ProviderStatus,
  PROVIDER_STATUS_META,
  getProviderStatus,
  isConfigReady,
} from './aiConfigSlice';
export { createStorageSlice, type StorageSlice } from './storageSlice';
export { createSyncSlice, type SyncSlice } from './syncSlice';
export { createAppSlice, type AppSlice, DEFAULT_EXTERNAL_AI_URL } from './appSlice';
export { createKnowledgeSlice, type KnowledgeSlice } from './knowledgeSlice';
