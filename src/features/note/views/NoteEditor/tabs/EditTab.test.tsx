import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditTab } from './EditTab';

vi.mock('../../../../editor', () => ({
  TipTapEditor: ({ contentId, title }: { contentId?: string; title?: string }) => (
    <div
      data-testid="mock-tiptap-editor"
      data-content-id={contentId ?? ''}
      data-title={title ?? ''}
    >
      mock editor
    </div>
  ),
}));

describe('EditTab', () => {
  it('将 noteId 透传为 contentId，确保切换便签时编辑器能强制同步内容', async () => {
    const noteAContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '便签 A' }] }],
    };
    const noteBContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '便签 B' }] }],
    };

    const { rerender } = render(
      <EditTab
        noteId="note-a"
        noteTitle="便签 A"
        editorContent={noteAContent}
        onTitleChange={() => undefined}
        onContentChange={() => undefined}
      />,
    );

    const editor = await screen.findByTestId('mock-tiptap-editor');
    expect(editor).toHaveAttribute('data-content-id', 'note-a');

    rerender(
      <EditTab
        noteId="note-b"
        noteTitle="便签 B"
        editorContent={noteBContent}
        onTitleChange={() => undefined}
        onContentChange={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-tiptap-editor')).toHaveAttribute('data-content-id', 'note-b');
    });
  });
});
