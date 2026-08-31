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
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ContentRenderer } from "../components/ContentRenderer";
import { IconButton, Sheet } from "../components/ui";
import { AIChatPanel } from "../features/reader/AIChatPanel";
import { ChapterSidebar } from "../features/reader/ChapterSidebar";
import { ReaderFooter } from "../features/reader/ReaderFooter";
import { ReaderNotesPanel } from "../features/reader/ReaderNotesPanel";
import { TextbookSearch } from "../features/reader/TextbookSearch";
import { useReadingProgress } from "../features/reader/useReadingProgress";
import { useCollection, useDocument } from "../hooks/useFirestoreData";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTextbook } from "../hooks/useTextbook";
import {
  addHighlight,
  deleteHighlight,
  requestNextChapterGeneration,
  toggleBookmark,
} from "../services/firebaseService";
import type {
  Bookmark as BookmarkModel,
  Highlight,
  Note,
  UserProgress,
} from "../types/models";
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
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"ai" | "notes" | null>(null);
  const [sidePanel, setSidePanel] = useState<"ai" | "notes" | null>("ai");
  const compactReader = useMediaQuery("(max-width: 800px)");
  const compactToc = useMediaQuery("(max-width: 1100px)");
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const [chapterError, setChapterError] = useState("");
  const [highlightError, setHighlightError] = useState("");
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [selection, setSelection] = useState<{
    pageId: string;
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [noteQuote, setNoteQuote] = useState<{
    pageId: string;
    text: string;
  } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const bookmarkedPageIds = new Set(
    bookmarks.filter((x) => x.textbookId === id).map((x) => x.pageId),
  );
  const marked = bookmarkedPageIds.has(pageId);
  const { data: notes } = useCollection<Note>(`users/${user?.uid}/notes`, {
    enabled: Boolean(user),
    filters: user ? [["ownerId", "==", user.uid]] : [],
  });
  const { data: highlights } = useCollection<Highlight>(
    `users/${user?.uid}/highlights`,
    {
      enabled: Boolean(user),
      filters: user ? [["ownerId", "==", user.uid]] : [],
    },
  );
  const pageNotes = notes.filter(
    (note) => note.textbookId === id && note.pageId === pageId,
  );
  const pageNote = [...pageNotes].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];
  const pageHighlights = highlights.filter(
    (highlight) =>
      highlight.textbookId === id && highlight.pageId === pageId,
  );
  const selectedHighlight = selection
    ? pageHighlights.find((highlight) => highlight.text === selection.text)
    : undefined;
  const clearNoteQuote = useCallback(() => setNoteQuote(null), []);
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
  function showPanel(panel: "ai" | "notes") {
    if (compactReader) {
      setMobilePanel(panel);
      return;
    }
    setSidePanel((current) => (current === panel ? null : panel));
  }
  function toggleToc() {
    if (compactToc) {
      setToc(true);
      return;
    }
    setTocCollapsed((collapsed) => !collapsed);
  }
  function captureSelection() {
    const selected = window.getSelection();
    const text = selected?.toString().trim() ?? "";
    if (!selected || selected.rangeCount === 0 || text.length < 2) {
      setSelection(null);
      return;
    }
    const range = selected.getRangeAt(0);
    const paper = document.querySelector(".reader-center .paper");
    if (!paper?.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelection({
      pageId,
      text: text.slice(0, 2000),
      x: Math.min(window.innerWidth - 126, Math.max(12, rect.left + rect.width / 2)),
      y: Math.max(12, rect.top - 52),
    });
  }
  async function toggleHighlight() {
    if (!user || !selection || selection.pageId !== pageId || savingHighlight)
      return;
    setSavingHighlight(true);
    setHighlightError("");
    try {
      if (selectedHighlight) {
        await deleteHighlight(user.uid, selectedHighlight.id);
      } else {
        await addHighlight(user.uid, id, pageId, selection.text);
      }
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    } catch (error) {
      setHighlightError(
        error instanceof Error
          ? error.message
          : selectedHighlight
            ? "マーカーを削除できませんでした"
            : "マーカーを保存できませんでした",
      );
    } finally {
      setSavingHighlight(false);
    }
  }
  function createNoteFromSelection() {
    if (!selection) return;
    setNoteQuote({ pageId, text: selection.text });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    if (compactReader) setMobilePanel("notes");
    else setSidePanel("notes");
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
      onNavigate={() => setToc(false)}
    />
  );
  const chat = <AIChatPanel textbookId={id} pageId={page.id} />;
  const notebook = (
    <ReaderNotesPanel
      key={page.id}
      uid={user?.uid}
      textbookId={id}
      pageId={page.id}
      note={pageNote}
      quote={noteQuote?.pageId === pageId ? noteQuote.text : undefined}
      onQuoteInserted={clearNoteQuote}
    />
  );
  return (
    <div
      className={`reader ${sidePanel ? "" : "chat-closed"} ${tocCollapsed ? "toc-closed" : ""}`}
    >
      {!tocCollapsed && <div className="reader-toc desktop">{sidebar}</div>}
      <section className="reader-center">
        <header className="reader-toolbar">
          <IconButton
            label={
              compactToc
                ? "目次を開く"
                : tocCollapsed
                  ? "目次を表示"
                  : "目次を折りたたむ"
            }
            aria-pressed={!compactToc && !tocCollapsed}
            onClick={toggleToc}
          >
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
            <IconButton
              label="ノート"
              aria-pressed={!compactReader && sidePanel === "notes"}
              onClick={() => showPanel("notes")}
            >
              <NotebookPen size={19} />
            </IconButton>
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
                  : sidePanel === "ai"
                    ? "AIチャットを閉じる"
                    : "AIチャットを開く"
              }
              aria-pressed={!compactReader && sidePanel === "ai"}
              onClick={() => showPanel("ai")}
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
        {highlightError && (
          <div className="reader-notice" role="alert">
            {highlightError}
          </div>
        )}
        <div className="reader-scroll" onMouseUp={captureSelection}>
          <article className="paper">
            <header>
              <span className="chapter-label">{book.category}</span>
              <h1>{withoutPageNumberPrefix(page.title)}</h1>
              {!containsGenerationMeta(book.subtitle) && (
                <p className="lead">{withoutInlineLinks(book.subtitle)}</p>
              )}
            </header>
            {page.blocks.map((b) => (
              <ContentRenderer
                key={b.id}
                block={b}
                highlights={pageHighlights}
              />
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
          {selection?.pageId === pageId && (
            <div
              className="selection-tools"
              style={{ left: selection.x, top: selection.y }}
              onMouseDown={(event) => event.preventDefault()}
            >
              <button
                aria-label={
                  selectedHighlight
                    ? "選択箇所のマーカーを削除"
                    : "選択箇所をマーカーとして保存"
                }
                title={selectedHighlight ? "マーカーを削除" : "マーカーを追加"}
                className={selectedHighlight ? "remove-highlight" : undefined}
                disabled={savingHighlight}
                onClick={() => void toggleHighlight()}
              >
                <Highlighter size={18} />
              </button>
              <button
                aria-label="選択箇所からノートを作成"
                onClick={createNoteFromSelection}
              >
                <NotebookPen size={18} />
              </button>
              <button
                aria-label="AIチャットを開く"
                onClick={() => showPanel("ai")}
              >
                <Bot size={18} />
              </button>
            </div>
          )}
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
      {sidePanel && (
        <div className="reader-ai desktop">
          <div className="reader-side-panel" key={sidePanel}>
            {sidePanel === "ai" ? chat : notebook}
          </div>
        </div>
      )}
      <div
        className={`reader-toc-drawer-layer ${compactReader && toc ? "open" : ""}`}
        aria-hidden={!compactReader || !toc}
      >
        <button
          type="button"
          className="reader-toc-drawer-backdrop"
          aria-label="目次を閉じる"
          tabIndex={compactReader && toc ? 0 : -1}
          onClick={() => setToc(false)}
        />
        <aside
          className="reader-toc-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="目次"
        >
          <IconButton label="目次を閉じる" onClick={() => setToc(false)}>
            <X size={19} />
          </IconButton>
          {sidebar}
        </aside>
      </div>
      <Sheet
        open={toc && !compactReader}
        onClose={() => setToc(false)}
        title="目次"
      >
        {sidebar}
      </Sheet>
      <Sheet
        open={compactReader && mobilePanel !== null}
        onClose={() => setMobilePanel(null)}
        title={mobilePanel === "notes" ? "このページのノート" : "Arcadia AI"}
      >
        {mobilePanel === "notes" ? notebook : chat}
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
