import {
  Bookmark,
  Check,
  ChevronDown,
  Circle,
  CircleHelp,
  LoaderCircle,
  Lock,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Chapter, Page, Textbook } from "../../types/models";
export function ChapterSidebar({
  book,
  chapters,
  pages,
  bookmarkedPageIds = new Set<string>(),
  progressPercent = 0,
  onGenerateChapter,
}: {
  book: Textbook;
  chapters: Chapter[];
  pages: Page[];
  bookmarkedPageIds?: Set<string>;
  progressPercent?: number;
  onGenerateChapter?: (chapter: Chapter) => void;
}) {
  const completedPages = Math.round((progressPercent / 100) * pages.length);
  return (
    <aside className="chapter-sidebar">
      <header>
        <span className="eyebrow">CONTENTS</span>
        <strong>{book.title}</strong>
        <small>
          全{chapters.length}章 · {pages.length}ページ
        </small>
      </header>
      <nav>
        {chapters.map((c) => (
          <section key={c.id}>
            <h3>
              <span>第{c.order}章</span>
              {c.title}
              <ChevronDown size={15} />
            </h3>
            {c.pageIds.map((id) => {
              const p = pages.find((x) => x.id === id);
              return p ? (
                <NavLink to={`/textbooks/${book.id}/read/${p.id}`} key={id}>
                  {p.order <= completedPages ? (
                    <Check size={14} />
                  ) : (
                    <Circle size={12} />
                  )}
                  <span>
                    {p.title}
                    <small>
                      {p.readMinutes}分
                      {bookmarkedPageIds.has(p.id) && (
                        <Bookmark
                          className="toc-bookmark"
                          size={11}
                          fill="currentColor"
                          aria-label="ブックマーク済み"
                        />
                      )}
                    </small>
                  </span>
                </NavLink>
              ) : null;
            })}
            {c.generationStatus === "completed" || !c.generationStatus ? (
              <NavLink
                className="chapter-quiz-link"
                to={`/textbooks/${book.id}/chapters/${c.id}/quiz`}
              >
                <CircleHelp size={14} />
                <span>
                  章末確認問題
                  <small>5問</small>
                </span>
              </NavLink>
            ) : ["queued", "generating"].includes(c.generationStatus) ? (
              <div className="chapter-generation-state">
                <LoaderCircle className="spin" size={14} />第{c.order}
                章を生成中… {c.generationProgress ?? 0}% ·{" "}
                {c.elapsedSeconds ?? 0}秒
              </div>
            ) : c.order === (book.nextChapterOrder ?? 1) ? (
              <button
                type="button"
                className="chapter-generate-button"
                onClick={() => onGenerateChapter?.(c)}
              >
                {c.generationStatus === "failed"
                  ? `第${c.order}章を再試行`
                  : `第${c.order}章を生成`}
              </button>
            ) : (
              <div className="chapter-generation-state locked">
                <Lock size={13} /> 前の章の生成後に利用できます
              </div>
            )}
          </section>
        ))}
      </nav>
      <footer>
        <div>
          <strong>{progressPercent}%</strong>
          <span>この教科書の進捗</span>
        </div>
        <div className="progress">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </footer>
    </aside>
  );
}
