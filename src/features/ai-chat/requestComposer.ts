import type { NoteReference } from './types';

interface SelectedNoteSnapshot {
  id: string;
  title: string;
  content: string;
}

export function buildOutgoingUserInput(
  text: string,
  selectedNotes: SelectedNoteSnapshot[],
): {
  text: string;
  references?: NoteReference[];
} {
  const normalizedText = text.trim();
  const references = selectedNotes.map((note) => ({
    id: note.id,
    title: note.title,
    byteLength: new TextEncoder().encode(note.content).length,
    content: note.content,
  }));

  return {
    text: normalizedText,
    references: references.length > 0 ? references : undefined,
  };
}
