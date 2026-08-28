import assert from "node:assert/strict";
import test from "node:test";
import { withoutInlineLinks } from "./sanitize.js";

test("removes a parenthesized markdown source citation", () => {
  assert.equal(
    withoutInlineLinks(
      "産業革命が始まった。 ([en.wikipedia.org](https://en.wikipedia.org/wiki/Industrial_Revolution?utm_source=openai))",
    ),
    "産業革命が始まった。",
  );
});

test("keeps markdown link labels but removes destinations", () => {
  assert.equal(
    withoutInlineLinks(
      "詳しくは[産業革命の解説](https://example.com/article)を参照。",
    ),
    "詳しくは産業革命の解説を参照。",
  );
});

test("removes naked URLs", () => {
  assert.equal(
    withoutInlineLinks("出典 https://example.com/source を確認。"),
    "出典 を確認。",
  );
});

test("removes a web-search citation from an outline summary", () => {
  assert.equal(
    withoutInlineLinks(
      "技術の変化を整理する。 ([bidhannagarcollege.org](https://www.bidhannagarcollege.org/source.pdf?utm_source=openai))",
    ),
    "技術の変化を整理する。",
  );
});
