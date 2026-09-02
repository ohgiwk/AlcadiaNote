import assert from "node:assert/strict";
import test from "node:test";
import { queueChapterContentWrites } from "./chapter-writes.js";
import type { GeneratedChapter, OutlineChapter } from "./types.js";

function fixtures(pageCount: number) {
  const approvedChapter: OutlineChapter = {
    title: "章",
    summary: "要約",
    sources: [],
    pages: Array.from({ length: pageCount }, (_, index) => ({
      title: `承認済み${index + 1}`,
      summary: "要約",
    })),
  };
  const result: GeneratedChapter = {
    pages: Array.from({ length: pageCount }, (_, index) => ({
      title: `生成結果${index + 1}`,
      readMinutes: index + 1,
      blocks: [],
      sources: [],
    })),
  };
  return { approvedChapter, result };
}

test("writes variable-length chapter pages with globally consecutive order", () => {
  const writes: Array<{ id: string; data: Record<string, unknown> }> = [];
  const batch = {
    set(ref: { id: string }, data: Record<string, unknown>) {
      writes.push({ id: ref.id, data });
    },
  };
  const bookRef = {
    collection() {
      return { doc: (id: string) => ({ id }) };
    },
  };
  const { approvedChapter, result } = fixtures(5);

  const ids = queueChapterContentWrites({
    batch: batch as never,
    bookRef: bookRef as never,
    chapterId: "chapter-2",
    pageOrderStart: 5,
    approvedChapter,
    result,
  });

  assert.deepEqual(ids, [
    "chapter-2-page-1",
    "chapter-2-page-2",
    "chapter-2-page-3",
    "chapter-2-page-4",
    "chapter-2-page-5",
  ]);
  assert.deepEqual(writes.map((write) => write.data.order), [6, 7, 8, 9, 10]);
  assert.deepEqual(
    writes.map((write) => write.data.title),
    approvedChapter.pages.map((page) => page.title),
  );
});

test("rejects generated content whose page count differs from the approved outline", () => {
  const { approvedChapter, result } = fixtures(2);
  result.pages.pop();
  assert.throws(
    () =>
      queueChapterContentWrites({
        batch: {} as never,
        bookRef: {} as never,
        chapterId: "chapter-1",
        pageOrderStart: 0,
        approvedChapter,
        result,
      }),
    /generated_page_count_mismatch/,
  );
});
