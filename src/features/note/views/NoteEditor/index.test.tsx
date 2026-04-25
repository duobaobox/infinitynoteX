import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NoteEditor } from './index';

const workspaceState = {
  selectedNoteId: 'note-a' as string | null,
  triggerListRefresh: vi.fn(),
  resetEditorTabTrigger: 0,
  noteTaskPath: null as number[] | null,
  clearNoteTaskPath: vi.fn(),
};

const settingsState = {
  enableInfiniteCanvas: false,
};

const { debouncedSaveMock, flushPendingSaveMock, syncTaskBaselineMock, editTabRenderSpy } =
  vi.hoisted(() => {
    const extractMockContentText = (content: unknown): string => {
      if (!content || typeof content !== 'object') {
        return '';
      }

      const node = content as { text?: string; content?: unknown[] };
      return `${node.text ?? ''}${(node.content ?? []).map(extractMockContentText).join('')}`;
    };

    return {
      debouncedSaveMock: vi.fn(),
      flushPendingSaveMock: vi.fn().mockResolvedValue(undefined),
      syncTaskBaselineMock: vi.fn(),
      editTabRenderSpy: vi.fn(
        ({
          noteId,
          noteTitle,
          editorContent,
        }: {
          noteId: string | null;
          noteTitle: string;
          editorContent: unknown;
        }) => (
          <div
            data-testid="edit-tab"
            data-note-id={noteId ?? ''}
            data-note-title={noteTitle}
            data-note-content={extractMockContentText(editorContent)}
          />
        ),
      ),
    };
  });

function extractContentText(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  const node = content as { text?: string; content?: unknown[] };
  return `${node.text ?? ''}${(node.content ?? []).map(extractContentText).join('')}`;
}

vi.mock('antd', () => ({
  Segmented: () => <div data-testid="segmented" />,
  Splitter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  message: {
    error: vi.fn(),
  },
  Spin: () => <div data-testid="spin" />,
}));

vi.mock('../../../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (state: typeof workspaceState) => unknown) =>
    selector(workspaceState),
}));

vi.mock('../../../../store/settingsStore', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('./hooks/useNoteSave', () => ({
  useNoteSave: () => ({
    debouncedSave: debouncedSaveMock,
    flushPendingSave: flushPendingSaveMock,
    syncTaskBaseline: syncTaskBaselineMock,
  }),
}));

vi.mock('../../../../shared/utils/ipcEvents', () => ({
  createNoteSyncPayload: vi.fn(),
  getRendererIpcSourceId: () => 'renderer-test',
  onRendererIpc: () => () => undefined,
  sendRendererIpc: vi.fn(),
}));

vi.mock('./tabs', () => ({
  EditTab: editTabRenderSpy,
  ToolsTab: () => <div data-testid="tools-tab" />,
  TAB_CONFIG: [
    { key: 'edit', icon: () => null, label: '编辑' },
    { key: 'ai', icon: () => null, label: 'AI' },
    { key: 'tools', icon: () => null, label: '工具' },
  ],
}));

describe('NoteEditor', () => {
  beforeEach(() => {
    workspaceState.selectedNoteId = 'note-a';
    workspaceState.resetEditorTabTrigger = 0;
    workspaceState.noteTaskPath = null;
    vi.clearAllMocks();
    flushPendingSaveMock.mockResolvedValue(undefined);
  });

  it('切换到新便签但内容尚未返回时，不会继续显示上一条便签的标题和内容', async () => {
    let resolveNoteA: ((value: unknown) => void) | null = null;
    let resolveNoteB: ((value: unknown) => void) | null = null;

    window.storage = {
      getNote: vi.fn((noteId: string) => {
        if (noteId === 'note-a') {
          return new Promise((resolve) => {
            resolveNoteA = resolve;
          });
        }

        if (noteId === 'note-b') {
          return new Promise((resolve) => {
            resolveNoteB = resolve;
          });
        }

        return Promise.reject(new Error(`unknown note: ${noteId}`));
      }),
    } as unknown as typeof window.storage;

    const { rerender } = render(<NoteEditor />);

    await waitFor(() => {
      expect(window.storage.getNote).toHaveBeenCalledWith('note-a');
      expect(resolveNoteA).not.toBeNull();
    });

    await act(async () => {
      resolveNoteA?.({
        id: 'note-a',
        title: 'AI 便签 A',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '这是 A 的 AI 内容' }] }],
        },
        color: 'ffffff',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-id', 'note-a');
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-title', 'AI 便签 A');
      expect(screen.getByTestId('edit-tab')).toHaveAttribute(
        'data-note-content',
        '这是 A 的 AI 内容',
      );
    });

    workspaceState.selectedNoteId = 'note-b';
    rerender(<NoteEditor />);

    await waitFor(() => {
      expect(window.storage.getNote).toHaveBeenCalledWith('note-b');
      expect(resolveNoteB).not.toBeNull();
    });

    expect(
      editTabRenderSpy.mock.calls.some(([props]) => {
        const renderProps = props as {
          noteId: string | null;
          noteTitle: string;
          editorContent: unknown;
        };
        return (
          renderProps.noteId === 'note-b' &&
          renderProps.noteTitle === 'AI 便签 A' &&
          extractContentText(renderProps.editorContent) === '这是 A 的 AI 内容'
        );
      }),
    ).toBe(false);

    expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-id', 'note-b');
    expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-title', '');
    expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-content', '');
  });

  it('切换便签时会忽略旧便签的迟到加载结果，避免内容串到当前便签', async () => {
    let resolveNoteA: ((value: unknown) => void) | null = null;
    let resolveNoteB: ((value: unknown) => void) | null = null;

    window.storage = {
      getNote: vi.fn((noteId: string) => {
        if (noteId === 'note-a') {
          return new Promise((resolve) => {
            resolveNoteA = resolve;
          });
        }

        if (noteId === 'note-b') {
          return new Promise((resolve) => {
            resolveNoteB = resolve;
          });
        }

        return Promise.reject(new Error(`unknown note: ${noteId}`));
      }),
    } as unknown as typeof window.storage;

    const { rerender } = render(<NoteEditor />);

    await waitFor(() => {
      expect(window.storage.getNote).toHaveBeenCalledWith('note-a');
      expect(resolveNoteA).not.toBeNull();
    });

    workspaceState.selectedNoteId = 'note-b';
    rerender(<NoteEditor />);

    await waitFor(() => {
      expect(window.storage.getNote).toHaveBeenCalledWith('note-b');
      expect(resolveNoteB).not.toBeNull();
    });

    await act(async () => {
      resolveNoteB?.({
        id: 'note-b',
        title: '便签 B',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '这是 B 的内容' }] }],
        },
        color: 'ffffff',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-id', 'note-b');
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-title', '便签 B');
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-content', '这是 B 的内容');
    });

    await act(async () => {
      resolveNoteA?.({
        id: 'note-a',
        title: 'AI 便签 A',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '这是 A 的 AI 内容' }] }],
        },
        color: 'ffffff',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-id', 'note-b');
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-title', '便签 B');
      expect(screen.getByTestId('edit-tab')).toHaveAttribute('data-note-content', '这是 B 的内容');
    });
  });
});
