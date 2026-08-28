import type { Bookmark, Note } from "../types/models";
export interface TextbookRepository {
  getProgress(id: string): number;
  saveProgress(id: string, value: number): void;
}
export interface NotesRepository {
  list(): Note[];
  save(note: Note): void;
}
export interface BookmarkRepository {
  list(): Bookmark[];
  toggle(pageId: string): void;
}
const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};
export const localTextbookRepository: TextbookRepository = {
  getProgress: (id) =>
    read<Record<string, number>>("arcadia-progress", {})[id] ?? 68,
  saveProgress: (id, value) =>
    localStorage.setItem(
      "arcadia-progress",
      JSON.stringify({ ...read("arcadia-progress", {}), [id]: value }),
    ),
};
export const localNotesRepository: NotesRepository = {
  list: () => read<Note[]>("arcadia-notes", []),
  save: (note) =>
    localStorage.setItem(
      "arcadia-notes",
      JSON.stringify([note, ...read<Note[]>("arcadia-notes", [])]),
    ),
};
export const localBookmarkRepository: BookmarkRepository = {
  list: () => read<Bookmark[]>("arcadia-bookmarks", []),
  toggle: (pageId) => {
    const items = read<Bookmark[]>("arcadia-bookmarks", []);
    const next = items.some((x) => x.pageId === pageId)
      ? items.filter((x) => x.pageId !== pageId)
      : [
          ...items,
          {
            id: crypto.randomUUID(),
            pageId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
    localStorage.setItem("arcadia-bookmarks", JSON.stringify(next));
  },
};
