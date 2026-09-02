import {
  FieldValue,
  type DocumentReference,
  type WriteBatch,
} from "firebase-admin/firestore";
import { containsGenerationMeta } from "./sanitize.js";
import { toContentBlock } from "./generation.js";
import type { GeneratedChapter, OutlineChapter } from "./types.js";

interface ChapterWriteOptions {
  batch: WriteBatch;
  bookRef: DocumentReference;
  chapterId: string;
  pageOrderStart: number;
  approvedChapter: OutlineChapter;
  result: GeneratedChapter;
}

export function queueChapterContentWrites(options: ChapterWriteOptions) {
  const { batch, bookRef, chapterId, pageOrderStart, approvedChapter, result } =
    options;
  const pageIds: string[] = [];

  if (result.pages.length !== approvedChapter.pages.length) {
    throw new Error("generated_page_count_mismatch");
  }

  for (const [index, page] of result.pages.entries()) {
    const pageRef = bookRef
      .collection("pages")
      .doc(`${chapterId}-page-${index + 1}`);
    pageIds.push(pageRef.id);
    batch.set(pageRef, {
      chapterId,
      title: approvedChapter.pages[index].title,
      order: pageOrderStart + index + 1,
      readMinutes: page.readMinutes,
      blocks: page.blocks
        .filter(
          (raw) =>
            !containsGenerationMeta(`${raw.title ?? ""} ${raw.text ?? ""}`),
        )
        .map(toContentBlock),
      sources: page.sources.map((source) => ({
        ...source,
        accessedAt: new Date().toISOString(),
      })),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return pageIds;
}
