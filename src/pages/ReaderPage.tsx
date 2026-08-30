import {
  Bookmark,
  Bot,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  List,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ContentRenderer } from "../components/ContentRenderer";
import { IconButton, Sheet } from "../components/ui";
import { AIChatPanel } from "../features/reader/AIChatPanel";
import { ChapterSidebar } from "../features/reader/ChapterSidebar";
import { TextbookSearch } from "../features/reader/TextbookSearch";
import { useCollection } from "../hooks/useFirestoreData";
import { useTextbook } from "../hooks/useTextbook";
import { saveProgress, toggleBookmark } from "../services/firebaseService";
import type { Bookmark as BookmarkModel } from "../types/models";
import { containsGenerationMeta, withoutInlineLinks } from "../utils/text";
export function ReaderPage() {
  const { id = "", pageId = "" } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { book, chapters, pages, loading } = useTextbook(id);
  const bookmarks = useCollection<BookmarkModel>(
    user ? `users/${user.uid}/bookmarks` : "__none__",
    user ? [where("ownerId", "==", user.uid)] : [],
  ).data;
  const page = pages.find((x) => x.id === pageId);
  const idx = pages.indexOf(page!);
  const [toc, setToc] = useState(false);
  const [ai, setAi] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const bookmarkedPageIds = new Set(
    bookmarks.filter((x) => x.textbookId === id).map((x) => x.pageId),
  );
  const marked = bookmarkedPageIds.has(pageId);
  useEffect(() => {
    document.querySelector(".reader-scroll")?.scrollTo(0, 0);
    if (user && page && pages.length)
      void saveProgress(
        user.uid,
        id,
        page.id,
        Math.round(((idx + 1) / pages.length) * 100),
      );
  }, [pageId, user, pages.length, id, idx, page]);
  if (loading) return <div className="page">教科書を読み込んでいます…</div>;
  if (!book || !page)
    return <div className="page">ページが見つかりません。</div>;
  const currentPageId = page.id;
  async function changeBookmark() {
    if (!user || bookmarking) return;
    setBookmarkError("");
    setBookmarking(true);
    try {
      await toggleBookmark(user.uid, id, currentPageId);
    } catch (error) {
      setBookmarkError(
        error instanceof Error
          ? error.message
          : "ブックマークを更新できませんでした",
      );
    } finally {
      setBookmarking(false);
    }
  }
  const sidebar = (
    <ChapterSidebar
      book={book}
      chapters={chapters}
      pages={pages}
      bookmarkedPageIds={bookmarkedPageIds}
    />
  );
  const chat = <AIChatPanel textbookId={id} pageId={page.id} />;
  return (
    <div className="reader">
      <div className="reader-toc desktop">{sidebar}</div>
      <section className="reader-center">
        <header className="reader-toolbar">
          <IconButton label="目次" onClick={() => setToc(true)}>
            <List size={20} />
          </IconButton>
          <div className="crumb">
            <Link to="/library">本棚</Link>
            <ChevronRight size={14} />
            <span>{book.title}</span>
          </div>
          <div>
            <IconButton label="本文を検索" onClick={() => setSearchOpen(true)}>
              <Search size={19} />
            </IconButton>
            <IconButton
              label={marked ? "ブックマークを解除" : "ブックマークに追加"}
              aria-pressed={marked}
              disabled={!user || bookmarking}
              onClick={() => void changeBookmark()}
            >
              <Bookmark size={19} fill={marked ? "currentColor" : "none"} />
            </IconButton>
            <Link
              className="icon-button"
              aria-label="ノート"
              to={`/textbooks/${id}/notes`}
            >
              <NotebookPen size={19} />
            </Link>
            <IconButton label="AIチャット" onClick={() => setAi(true)}>
              <Sparkles size={19} />
            </IconButton>
            <Link
              className="icon-button"
              aria-label="条件を変えて再生成"
              to="/create"
              state={{
                topic: book.topic ?? book.title,
                level: book.level ?? "AIに任せる",
                purpose: book.purpose ?? "教養",
                sourceTextbookId: book.id,
              }}
            >
              <RefreshCw size={19} />
            </Link>
            <IconButton label="表示設定">
              <Settings2 size={19} />
            </IconButton>
            <IconButton label="その他">
              <MoreHorizontal size={19} />
            </IconButton>
          </div>
        </header>
        {bookmarkError && (
          <div className="reader-notice" role="alert">
            {bookmarkError}
          </div>
        )}
        <div className="reader-scroll">
          <article className="paper">
            <header>
              <span className="chapter-label">{book.category}</span>
              <h1>{page.title}</h1>
              {!containsGenerationMeta(book.subtitle) && (
                <p className="lead">{withoutInlineLinks(book.subtitle)}</p>
              )}
              <div className="read-meta">
                <span>{page.readMinutes}分で読めます</span>
                <span>AI生成教科書</span>
              </div>
            </header>
            {page.blocks.map((b) => (
              <ContentRenderer key={b.id} block={b} />
            ))}
            {page.sources?.length ? (
              <section className="page-sources">
                <h2>参照元</h2>
                <ol>
                  {page.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </article>
          <div className="selection-tools">
            <Highlighter />
            <NotebookPen />
            <Bot />
          </div>
        </div>
        <footer className="page-nav">
          <button
            disabled={idx <= 0}
            onClick={() =>
              idx > 0 && nav(`/textbooks/${id}/read/${pages[idx - 1].id}`)
            }
          >
            <ChevronLeft />
            前のページ
          </button>
          <span>
            {idx + 1} / {pages.length}
          </span>
          <button
            disabled={idx < 0 || idx === pages.length - 1}
            onClick={() =>
              idx >= 0 &&
              idx < pages.length - 1 &&
              nav(`/textbooks/${id}/read/${pages[idx + 1].id}`)
            }
          >
            次のページ
            <ChevronRight />
          </button>
        </footer>
      </section>
      <div className="reader-ai desktop">{chat}</div>
      <Sheet open={toc} onClose={() => setToc(false)} title="目次">
        {sidebar}
      </Sheet>
      <Sheet open={ai} onClose={() => setAi(false)} title="Arcadia AI">
        {chat}
      </Sheet>
      <Sheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="教科書内を検索"
        variant="dialog"
      >
        <TextbookSearch
          pages={pages}
          onSelect={(selectedPageId) => {
            setSearchOpen(false);
            nav(`/textbooks/${id}/read/${selectedPageId}`);
          }}
        />
      </Sheet>
    </div>
  );
}
