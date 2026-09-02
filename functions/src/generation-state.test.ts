import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERATION_LOCK_TTL_MS,
  canQueueChapter,
  chapterCompletionState,
  chapterFailureBookStatus,
  chapterPageOrderStart,
  hasActiveGenerationLock,
} from "./generation-state.js";
import type { TextbookOutline } from "./types.js";

const outline = (pageCounts: number[]): TextbookOutline => ({
  title: "教科書",
  subtitle: "副題",
  category: "分類",
  chapters: pageCounts.map((count, chapterIndex) => ({
    title: `章${chapterIndex + 1}`,
    summary: "要約",
    sources: [],
    pages: Array.from({ length: count }, (_, pageIndex) => ({
      title: `ページ${pageIndex + 1}`,
      summary: "要約",
    })),
  })),
});

test("generation lock is active only inside its TTL", () => {
  const now = 2_000_000;
  assert.equal(hasActiveGenerationLock(false, now, now), false);
  assert.equal(hasActiveGenerationLock(true, now - 1, now), true);
  assert.equal(
    hasActiveGenerationLock(true, now - GENERATION_LOCK_TTL_MS, now),
    false,
  );
});

test("chapter retry statuses require a lock only while already queued", () => {
  assert.equal(canQueueChapter("pending", false), true);
  assert.equal(canQueueChapter("failed", false), true);
  assert.equal(canQueueChapter("queued", false), false);
  assert.equal(canQueueChapter("generating", false), false);
  assert.equal(canQueueChapter("queued", true), true);
  assert.equal(canQueueChapter("completed", true), false);
});

test("page order starts after every page in preceding variable-length chapters", () => {
  const value = outline([5, 1, 8]);
  assert.equal(chapterPageOrderStart(value, 1), 0);
  assert.equal(chapterPageOrderStart(value, 2), 5);
  assert.equal(chapterPageOrderStart(value, 3), 6);
});

test("chapter success and failure produce the expected book states", () => {
  assert.deepEqual(chapterCompletionState(2, 3), {
    generatedChapterCount: 2,
    nextChapterOrder: 3,
    activeChapterId: null,
    generationStatus: "ready",
  });
  assert.equal(chapterCompletionState(3, 3).generationStatus, "completed");
  assert.equal(chapterFailureBookStatus(1), "failed");
  assert.equal(chapterFailureBookStatus(2), "ready");
});
