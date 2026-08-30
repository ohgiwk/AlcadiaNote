import { BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ContentBlock, Page } from "../../types/models";
import { withoutInlineLinks } from "../../utils/text";

function blockText(block: ContentBlock) {
  return Object.entries(block)
    .filter(([key]) => !["id", "type", "language"].includes(key))
    .flatMap(([, value]) => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return [JSON.stringify(value)];
      return [];
    })
    .join(" ");
}

function searchableText(page: Page) {
  return withoutInlineLinks(
    [page.title, ...page.blocks.map(blockText)].join(" "),
  );
}

function resultExcerpt(text: string, query: string) {
  const index = text.toLocaleLowerCase("ja").indexOf(query);
  const start = Math.max(0, index - 45);
  const excerpt = text.slice(start, start + 150);
  return `${start > 0 ? "…" : ""}${excerpt}${start + 150 < text.length ? "…" : ""}`;
}

export function TextbookSearch({
  pages,
  onSelect,
}: {
  pages: Page[];
  onSelect: (pageId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return pages
      .map((page) => ({ page, text: searchableText(page) }))
      .filter(({ text }) =>
        text.toLocaleLowerCase("ja").includes(normalizedQuery),
      );
  }, [normalizedQuery, pages]);

  return (
    <div className="textbook-search">
      <label>
        <Search size={18} />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ページタイトル・本文を検索"
        />
      </label>
      <div className="textbook-search-results" aria-live="polite">
        {!normalizedQuery ? (
          <div className="textbook-search-empty">
            <Search size={24} />
            <p>教科書内のキーワードを入力してください。</p>
          </div>
        ) : results.length === 0 ? (
          <div className="textbook-search-empty">
            <p>「{query.trim()}」に一致するページはありません。</p>
          </div>
        ) : (
          <>
            <small>{results.length}ページ見つかりました</small>
            {results.map(({ page, text }) => (
              <button
                type="button"
                key={page.id}
                onClick={() => onSelect(page.id)}
              >
                <BookOpen size={17} />
                <span>
                  <strong>{page.title}</strong>
                  <small>{resultExcerpt(text, normalizedQuery)}</small>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
