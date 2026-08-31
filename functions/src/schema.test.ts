import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdaptiveTextbookOutlineSchema,
  buildChapterContentSchema,
  buildChapterRevisionOutlineSchema,
  buildTextbookOutlineSchema,
  chapterContentSchema,
  textbookOutlineSchema,
} from "./schema.js";

test("adaptive outline schema lets AI choose two to eight chapters and one to eight pages", () => {
  const schema = buildAdaptiveTextbookOutlineSchema();
  const chapters = schema.properties.chapters;
  assert.equal(chapters.minItems, 2);
  assert.equal(chapters.maxItems, 8);
  assert.equal(chapters.items.properties.pages.minItems, 1);
  assert.equal(chapters.items.properties.pages.maxItems, 8);
});

test("chapter revision keeps the chapter count while allowing page count changes", () => {
  const schema = buildChapterRevisionOutlineSchema(5);
  const chapters = schema.properties.chapters;
  assert.equal(chapters.minItems, 5);
  assert.equal(chapters.maxItems, 5);
  assert.equal(chapters.items.properties.pages.minItems, 1);
  assert.equal(chapters.items.properties.pages.maxItems, 8);
});

test("outline schema requires exactly four chapters and three pages", () => {
  const chapters = textbookOutlineSchema.properties.chapters;
  assert.equal(chapters.minItems, 4);
  assert.equal(chapters.maxItems, 4);
  assert.equal(chapters.items.properties.pages.minItems, 3);
  assert.equal(chapters.items.properties.pages.maxItems, 3);
  assert.equal(chapters.items.properties.sources.minItems, 3);
  assert.equal(chapters.items.properties.sources.maxItems, 6);
});

test("schema builders support variable chapter and page counts", () => {
  const outline = buildTextbookOutlineSchema(8, [1, 2, 3, 4, 5, 6, 2, 1]);
  assert.equal(outline.properties.chapters.minItems, 8);
  assert.equal(outline.properties.chapters.maxItems, 8);
  assert.equal(outline.properties.chapters.items.properties.pages.minItems, 1);
  assert.equal(outline.properties.chapters.items.properties.pages.maxItems, 6);
  const chapter = buildChapterContentSchema(6);
  assert.equal(chapter.properties.pages.minItems, 6);
  assert.equal(chapter.properties.pages.maxItems, 6);
});

test("chapter schema produces three pages, five quizzes, and two cards", () => {
  assert.equal(chapterContentSchema.properties.pages.minItems, 3);
  assert.equal(chapterContentSchema.properties.pages.maxItems, 3);
  assert.equal(
    chapterContentSchema.properties.pages.items.properties.sources.minItems,
    1,
  );
  assert.equal(chapterContentSchema.properties.quizzes.minItems, 5);
  assert.equal(chapterContentSchema.properties.quizzes.maxItems, 5);
  assert.equal(chapterContentSchema.properties.flashcards.minItems, 2);
  assert.equal(chapterContentSchema.properties.flashcards.maxItems, 2);
});

test("generated content excludes image blocks", () => {
  const values =
    chapterContentSchema.properties.pages.items.properties.blocks.items
      .properties.type.enum;
  assert.equal(values.includes("image" as never), false);
});
