import assert from "node:assert/strict";
import test from "node:test";
import {
  containsGenerationMeta,
  withoutInlineLinks,
  withoutPageNumberPrefix,
} from "./sanitize.js";

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

test("detects generation-process text that must not appear in pages", () => {
  assert.equal(
    containsGenerationMeta(
      "中級向けロードマップと目次（本文・問題・暗記カードは未作成）",
    ),
    true,
  );
  assert.equal(containsGenerationMeta("産業革命が社会を変えた背景"), false);
});

test("removes page number prefixes from generated titles", () => {
  assert.equal(
    withoutPageNumberPrefix("ページ1；産業革命の始まり"),
    "産業革命の始まり",
  );
  assert.equal(withoutPageNumberPrefix("ページ２：技術革新"), "技術革新");
});
