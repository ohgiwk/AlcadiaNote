import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Circle,
  Lock,
  Map,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTextbook } from "../hooks/useTextbook";
import { withoutInlineLinks, withoutPageNumberPrefix } from "../utils/text";

export function TextbookRoadmapPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const { book, chapters, pages, loading } = useTextbook(id);
  const returnTo =
    typeof location.state?.returnTo === "string"
      ? location.state.returnTo
      : book?.firstPageId
        ? `/textbooks/${id}/read/${book.firstPageId}`
        : "/library";

  if (loading) return <div className="page">ロードマップを読み込んでいます…</div>;
  if (!book) return <div className="page">教科書が見つかりません。</div>;

  const outline = book.outline;
  const completedCount = chapters.filter((chapter) => chapter.progress >= 100).length;
  const activeChapter =
    chapters.find((chapter) => chapter.id === book.activeChapterId) ??
    chapters.find((chapter) => chapter.progress < 100);

  return (
    <main className="textbook-roadmap-page">
      <header className="textbook-roadmap-bar">
        <Link className="icon-button" aria-label="リーダーに戻る" title="リーダーに戻る" to={returnTo}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <Map size={18} />
          <span>学習ロードマップ</span>
        </div>
        <Link to="/library">本棚</Link>
      </header>

      {!outline ? (
        <section className="textbook-roadmap-empty">
          <BookOpen size={34} />
          <h1>ロードマップが見つかりません</h1>
          <p>この教科書には生成時のロードマップが保存されていません。</p>
          <Link className="button primary" to={returnTo}>リーダーに戻る</Link>
        </section>
      ) : (
        <div className="textbook-roadmap-content">
          <section className="textbook-roadmap-hero">
            <span className="eyebrow">YOUR LEARNING PATH</span>
            <h1>{withoutInlineLinks(outline.title || book.title)}</h1>
            <p>{withoutInlineLinks(outline.subtitle || book.subtitle)}</p>
            <div className="textbook-roadmap-summary">
              <strong>{completedCount} / {outline.chapters.length}</strong>
              <span>章を完了</span>
              <div><i style={{ width: `${outline.chapters.length ? (completedCount / outline.chapters.length) * 100 : 0}%` }} /></div>
            </div>
          </section>

          <section className="textbook-roadmap-list" aria-label="章のロードマップ">
            {outline.chapters.map((outlineChapter, index) => {
              const chapter = chapters.find((item) => item.order === index + 1);
              const status = chapter?.progress && chapter.progress >= 100
                ? "done"
                : chapter?.id === activeChapter?.id
                  ? "current"
                  : "locked";
              const firstPageId = chapter?.pageIds[0] ?? pages.find((page) => page.chapterId === chapter?.id)?.id;
              return (
                <article className={status} key={`${index}-${outlineChapter.title}`}>
                  <div className="textbook-roadmap-marker">
                    {status === "done" ? <Check /> : status === "current" ? <Circle /> : <Lock />}
                  </div>
                  <div className="textbook-roadmap-chapter">
                    <span>CHAPTER {String(index + 1).padStart(2, "0")}</span>
                    <h2>{withoutInlineLinks(outlineChapter.title)}</h2>
                    <p>{withoutInlineLinks(outlineChapter.summary)}</p>
                    <ol>
                      {outlineChapter.pages.map((outlinePage, pageIndex) => (
                        <li key={`${pageIndex}-${outlinePage.title}`}>
                          <span>{pageIndex + 1}</span>
                          <div>
                            <strong>{withoutPageNumberPrefix(withoutInlineLinks(outlinePage.title))}</strong>
                            <small>{withoutInlineLinks(outlinePage.summary)}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {firstPageId && (
                    <Link className="textbook-roadmap-action" to={`/textbooks/${id}/read/${firstPageId}`}>
                      {status === "done" ? "復習する" : "学習する"}<ArrowUpRight size={17} />
                    </Link>
                  )}
                </article>
              );
            })}
          </section>
        </div>
      )}
    </main>
  );
}
