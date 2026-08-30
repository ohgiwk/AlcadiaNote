import assert from "node:assert/strict";
import test from "node:test";
import { textbookOutlineSchema, textbookSchema } from "./schema.js";

test("outline schema requires exactly four chapters and three pages", () => {
  const chapters = textbookOutlineSchema.properties.chapters;
  assert.equal(chapters.minItems, 4);
  assert.equal(chapters.maxItems, 4);
  assert.equal(chapters.items.properties.pages.minItems, 3);
  assert.equal(chapters.items.properties.pages.maxItems, 3);
});

test("textbook schema requires exactly four chapters and three pages", () => {
  const chapters = textbookSchema.properties.chapters;
  assert.equal(chapters.minItems, 4);
  assert.equal(chapters.maxItems, 4);
  assert.equal(chapters.items.properties.pages.minItems, 3);
  assert.equal(chapters.items.properties.pages.maxItems, 3);
  assert.equal(chapters.items.properties.quizzes.minItems, 5);
  assert.equal(chapters.items.properties.quizzes.maxItems, 5);
});

test("generated content excludes image blocks", () => {
  const values =
    textbookSchema.properties.chapters.items.properties.pages.items.properties
      .blocks.items.properties.type.enum;
  assert.equal(values.includes("image" as never), false);
});
