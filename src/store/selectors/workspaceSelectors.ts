/**
 * Workspace Selectors - 性能优化的选择器
 * 通过 selector 减少不必要的重渲染
 */

import type { WorkspaceState } from '../workspaceStore';

// ============ UI Selectors ============
export const selectShowEditor = (state: WorkspaceState) => state.showEditor;
export const selectShowSidebar = (state: WorkspaceState) => state.showSidebar;

// ============ Folder Selectors ============
export const selectFolders = (state: WorkspaceState) => state.folders;
export const selectSelectedFolderId = (state: WorkspaceState) => state.selectedFolderId;
export const selectCurrentFolderName = (state: WorkspaceState) => state.currentFolderName;
export const selectSelectedFolder = (state: WorkspaceState) =>
  state.folders.find((f) => f.id === state.selectedFolderId) ?? null;

// ============ Note Selectors ============
export const selectNotes = (state: WorkspaceState) => state.notes;
export const selectSelectedNoteId = (state: WorkspaceState) => state.selectedNoteId;
export const selectRefreshListTrigger = (state: WorkspaceState) => state.refreshListTrigger;
export const selectSelectedNote = (state: WorkspaceState) =>
  state.notes.find((n) => n.id === state.selectedNoteId) ?? null;
export const selectPinnedNotes = (state: WorkspaceState) => state.notes.filter((n) => n.pinned);
export const selectUnpinnedNotes = (state: WorkspaceState) => state.notes.filter((n) => !n.pinned);

// ============ AI Conversation Selectors ============
export const selectAIConversations = (state: WorkspaceState) => state.aiConversations;
export const selectSelectedToolId = (state: WorkspaceState) => state.selectedToolId;
export const selectSelectedToolItemId = (state: WorkspaceState) => state.selectedToolItemId;
export const selectRefreshAIConversationsTrigger = (state: WorkspaceState) =>
  state.refreshAIConversationsTrigger;

// ============ Workspace View Selectors ============
export const selectWorkspaceView = (state: WorkspaceState) => state.workspaceView;
export const selectResetEditorTabTrigger = (state: WorkspaceState) => state.resetEditorTabTrigger;
export const selectIsFirstLaunch = (state: WorkspaceState) => state.isFirstLaunch;

// ============ Composite Selectors (派生状态) ============

/**
 * 判断当前是否处于便签编辑模式
 */
export const selectIsNoteEditMode = (state: WorkspaceState) =>
  state.workspaceView === 'note' && state.selectedNoteId !== null;

/**
 * 判断当前是否处于 AI 对话模式
 */
export const selectIsAIChatMode = (state: WorkspaceState) =>
  state.workspaceView === 'tool' && state.selectedToolId === 'ai-chat';

/**
 * 获取当前文件夹的便签数量
 */
export const selectCurrentFolderNoteCount = (state: WorkspaceState) => state.notes.length;

/**
 * 获取 AI 对话数量
 */
export const selectAIConversationCount = (state: WorkspaceState) => state.aiConversations.length;
