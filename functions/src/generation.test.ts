import assert from "node:assert/strict";
import test from "node:test";
import { toContentBlock } from "./generation.js";
import type { GeneratedBlock } from "./types.js";

const generatedBlock = (
  overrides: Partial<GeneratedBlock>,
): GeneratedBlock => ({
  type: "paragraph",
  text: "本文",
  title: "",
  language: "",
  items: [],
  headers: [],
  rows: [],
  ...overrides,
});

test("normalizes timeline blocks to the supported checklist model", () => {
  const block = toContentBlock(
    generatedBlock({ type: "timeline", items: ["年表項目"] }),
  );
  assert.equal(block.type, "checklist");
  assert.deepEqual("items" in block ? block.items : [], ["年表項目"]);
});

test("removes inline links while converting paragraph blocks", () => {
  const block = toContentBlock(
    generatedBlock({ text: "[参照名](https://example.com) の説明" }),
  );
  assert.equal("text" in block ? block.text : "", "参照名 の説明");
});

test("preserves code text and normalizes its language label", () => {
  const block = toContentBlock(
    generatedBlock({
      type: "code",
      text: "const answer = 42;",
      language: "JavaScript ",
    }),
  );
  assert.equal(block.type, "code");
  assert.equal("language" in block ? block.language : "", "javascript");
  assert.equal("code" in block ? block.code : "", "const answer = 42;");
});
