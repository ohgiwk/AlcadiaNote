import type { TextbookOutline } from "./types.js";

export const GENERATION_LOCK_TTL_MS = 15 * 60_000;

export function hasActiveGenerationLock(
  exists: boolean,
  createdAtMs: number,
  nowMs = Date.now(),
) {
  return exists && nowMs - createdAtMs < GENERATION_LOCK_TTL_MS;
}

export function canQueueChapter(status: unknown, lockExists: boolean) {
  if (!["pending", "failed", "queued", "generating"].includes(String(status))) {
    return false;
  }
  return !["queued", "generating"].includes(String(status)) || lockExists;
}

export function chapterPageOrderStart(
  outline: TextbookOutline,
  chapterOrder: number,
) {
  if (!Number.isInteger(chapterOrder) || chapterOrder < 1) {
    throw new Error("invalid_chapter_order");
  }
  return outline.chapters
    .slice(0, chapterOrder - 1)
    .reduce((total, chapter) => total + chapter.pages.length, 0);
}

export function chapterCompletionState(chapterOrder: number, chapterCount: number) {
  const completed = chapterOrder === chapterCount;
  return {
    generatedChapterCount: chapterOrder,
    nextChapterOrder: chapterOrder + 1,
    activeChapterId: null,
    generationStatus: completed ? "completed" : "ready",
  } as const;
}

export function chapterFailureBookStatus(chapterOrder: number) {
  return chapterOrder === 1 ? "failed" : "ready";
}
