import {
  Bookmark,
  Bot,
  ChevronRight,
  GalleryVerticalEnd,
  Highlighter,
  List,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ContentRenderer } from "../components/ContentRenderer";
import { IconButton, Sheet } from "../components/ui";
import { AIChatPanel } from "../features/reader/AIChatPanel";
import { ChapterSidebar } from "../features/reader/ChapterSidebar";
import { ReaderFooter } from "../features/reader/ReaderFooter";
import { TextbookSearch } from "../features/reader/TextbookSearch";
import { useReadingProgress } from "../features/reader/useReadingProgress";
import { useCollection, useDocument } from "../hooks/useFirestoreData";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTextbook } from "../hooks/useTextbook";
import {
  requestNextChapterGeneration,
  toggleBookmark,
} from "../services/firebaseService";
import type { Bookmark as BookmarkModel, UserProgress } from "../types/models";
import {
  containsGenerationMeta,
  withoutInlineLinks,
  withoutPageNumberPrefix,
} from "../utils/text";
export function ReaderPage() {
  const { id = "", pageId = "" } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { book, chapters, pages, loading } = useTextbook(id);
  const bookmarks = useCollection<BookmarkModel>(
    `users/${user?.uid}/bookmarks`,
    {
      enabled: Boolean(user),
      filters: user ? [["ownerId", "==", user.uid]] : [],
    },
  ).data;
  const { data: savedProgress } = useDocument<UserProgress>(
    user ? `users/${user.uid}/progress/${id}` : undefined,
  );
  const page = pages.find((x) => x.id === pageId);
  const currentChapter = chapters.find(
    (chapter) => chapter.id === page?.chapterId,
  );
  const isChapterEnd = currentChapter?.pageIds.at(-1) === pageId;
  const idx = pages.indexOf(page!);
  const [toc, setToc] = useState(false);
  const [ai, setAi] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const compactReader = useMediaQuery("(max-width: 800px)");
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const [chapterError, setChapterError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const bookmarkedPageIds = new Set(
    bookmarks.filter((x) => x.textbookId === id).map((x) => x.pageId),
  );
  const marked = bookmarkedPageIds.has(pageId);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);
  useReadingProgress({
    uid: user?.uid,
    textbookId: id,
    page,
    pageIndex: idx,
    pageCount: pages.length,
  });
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
      progressPercent={savedProgress?.percent ?? 0}
      onGenerateChapter={() => {
        setChapterError("");
        void requestNextChapterGeneration(id).catch((error) =>
          setChapterError(
            error instanceof Error ? error.message : "章を生成できませんでした",
          ),
        );
      }}
    />
  );
  const chat = <AIChatPanel textbookId={id} pageId={page.id} />;
  return (
    <div className={`reader ${chatOpen ? "" : "chat-closed"}`}>
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
            <Link
              className="icon-button"
              aria-label="暗記カード"
              title="暗記カード"
              to={`/textbooks/${id}/flashcards`}
            >
              <GalleryVerticalEnd size={19} />
            </Link>
            <IconButton
              label={
                compactReader
                  ? "AIチャットを開く"
                  : chatOpen
                    ? "AIチャットを閉じる"
                    : "AIチャットを開く"
              }
              aria-pressed={!compactReader && chatOpen}
              onClick={() =>
                compactReader ? setAi(true) : setChatOpen((open) => !open)
              }
            >
              <Sparkles size={19} />
            </IconButton>
            <IconButton label="表示設定">
              <Settings2 size={19} />
            </IconButton>
            <div className="reader-more" ref={moreRef}>
              <IconButton
                label="その他"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <MoreHorizontal size={19} />
              </IconButton>
              {moreOpen && (
                <div className="reader-more-menu" role="menu">
                  <Link
                    role="menuitem"
                    to="/create"
                    state={{
                      topic: book.topic ?? book.title,
                      level: book.level ?? "AIに任せる",
                      purpose: book.purpose ?? "教養",
                      sourceTextbookId: book.id,
                    }}
                    onClick={() => setMoreOpen(false)}
                  >
                    <RefreshCw size={16} />
                    条件を変えて再生成
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
        {bookmarkError && (
          <div className="reader-notice" role="alert">
            {bookmarkError}
          </div>
        )}
        {chapterError && (
          <div className="reader-notice" role="alert">
            {chapterError}
          </div>
        )}
        <div className="reader-scroll">
          <article className="paper">
            <header>
              <span className="chapter-label">{book.category}</span>
              <h1>{withoutPageNumberPrefix(page.title)}</h1>
              {!containsGenerationMeta(book.subtitle) && (
                <p className="lead">{withoutInlineLinks(book.subtitle)}</p>
              )}
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
        <ReaderFooter
          textbookId={id}
          pages={pages}
          pageIndex={idx}
          currentChapter={currentChapter}
          isChapterEnd={isChapterEnd}
          onNavigate={nav}
        />
      </section>
      {chatOpen && <div className="reader-ai desktop">{chat}</div>}
      <Sheet open={toc} onClose={() => setToc(false)} title="目次">
        {sidebar}
      </Sheet>
      <Sheet
        open={compactReader && ai}
        onClose={() => setAi(false)}
        title="Arcadia AI"
      >
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
