import {
  Bookmark,
  Check,
  ChevronDown,
  Circle,
  CircleHelp,
  Home,
  LoaderCircle,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Chapter, Page, Textbook } from "../../types/models";
import { withoutPageNumberPrefix } from "../../utils/text";
export function ChapterSidebar({
  book,
  chapters,
  pages,
  bookmarkedPageIds = new Set<string>(),
  progressPercent = 0,
  onGenerateChapter,
  onNavigate,
}: {
  book: Textbook;
  chapters: Chapter[];
  pages: Page[];
  bookmarkedPageIds?: Set<string>;
  progressPercent?: number;
  onGenerateChapter?: (chapter: Chapter) => void;
  onNavigate?: () => void;
}) {
  const completedPages = Math.round((progressPercent / 100) * pages.length);
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(
    () => new Set(),
  );
  function toggleChapter(chapterId: string) {
    setCollapsedChapters((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }
  return (
    <aside className="chapter-sidebar">
      <header>
        <Link className="reader-home-link" to="/home" onClick={onNavigate}>
          <Home size={15} />
          ホームへ戻る
        </Link>
        <span className="eyebrow">CONTENTS</span>
        <strong>{book.title}</strong>
        <small>
          全{chapters.length}章 · {pages.length}ページ
        </small>
      </header>
      <nav>
        {chapters.map((c) => {
          const collapsed = collapsedChapters.has(c.id);
          return (
          <section className={collapsed ? "collapsed" : ""} key={c.id}>
            <h3>
              <button
                type="button"
                aria-expanded={!collapsed}
                onClick={() => toggleChapter(c.id)}
              >
                <span>第{c.order}章</span>
                <strong>{c.title}</strong>
                <ChevronDown size={15} />
              </button>
            </h3>
            <div className="chapter-toc-content">
              <div>
            {c.pageIds.map((id) => {
              const p = pages.find((x) => x.id === id);
              return p ? (
                <NavLink
                  to={`/textbooks/${book.id}/read/${p.id}`}
                  key={id}
                  onClick={onNavigate}
                >
                  {p.order <= completedPages ? (
                    <Check size={14} />
                  ) : (
                    <Circle size={12} />
                  )}
                  <span>
                    {withoutPageNumberPrefix(p.title)}
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
                onClick={onNavigate}
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
              </div>
            </div>
          </section>
          );
        })}
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
