import type { Note, NoteIndex } from '../../services/types';

interface FolderNoteGroup {
  folderId: string;
  folderName: string;
  notes: NoteIndex[];
}

const DEFAULT_NOTE_LOAD_CONCURRENCY = 12;

/**
 * 并发映射工具（限制并发度，避免一次性创建过多请求）
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R | null>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: Array<R | null> = new Array(items.length).fill(null);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.filter((item): item is R => item !== null);
}

/**
 * 读取所有文件夹下的便签索引（并发按文件夹读取）
 */
export async function loadFolderNoteGroups(): Promise<FolderNoteGroup[]> {
  const folders = await window.storage.listFolders();
  const groups = await Promise.all(
    folders.map(async (folder) => ({
      folderId: folder.id,
      folderName: folder.name || '未命名文件夹',
      notes: await window.storage.listNotes(folder.id),
    })),
  );
  return groups.filter((group) => group.notes.length > 0);
}

/**
 * 并发读取所有便签完整内容
 */
export async function loadAllNotes(concurrency = DEFAULT_NOTE_LOAD_CONCURRENCY): Promise<Note[]> {
  const groups = await loadFolderNoteGroups();
  const noteIndices = groups.flatMap((group) => group.notes);

  return mapWithConcurrency(noteIndices, concurrency, async (noteIndex) => {
    try {
      return await window.storage.getNote(noteIndex.id);
    } catch (error) {
      console.error(`[noteLoader] Failed to load note ${noteIndex.id}:`, error);
      return null;
    }
  });
}
