import {
  BookOpen,
  Heart,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Textbook } from "../types/models";
import { Progress } from "./ui";
export function BookCover({
  book,
  compact = false,
  onDelete,
  onRegenerate,
  deleting = false,
  showGenerationConditions = false,
}: {
  book: Textbook;
  compact?: boolean;
  onDelete?: () => void;
  onRegenerate?: () => void;
  deleting?: boolean;
  showGenerationConditions?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ready =
    ["ready", "completed"].includes(book.generationStatus ?? "") &&
    book.firstPageId;
  const needsApproval =
    book.generationStatus === "awaiting_approval" && book.generationJobId;
  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [menuOpen]);
  return (
    <article className={`book-card-container ${menuOpen ? "menu-open" : ""}`}>
      <Link
        to={
          ready
            ? `/textbooks/${book.id}/read/${book.firstPageId}`
            : needsApproval
              ? `/create?job=${book.generationJobId}`
              : "/library"
        }
        className={`book-card ${compact ? "compact" : ""}`}
      >
        <div className={`book-cover ${book.cover}`}>
          <div className="cover-rule" />
          <BookOpen size={20} />
          <div>
            <small>{book.category}</small>
            <h3>{book.title}</h3>
            <p>
              {book.generationStatus === "failed"
                ? "生成に失敗しました"
                : book.generationStatus === "awaiting_approval"
                  ? "ロードマップを確認してください"
                  : !["ready", "completed"].includes(
                        book.generationStatus ?? "",
                      )
                    ? "生成中…"
                    : book.subtitle}
            </p>
          </div>
          {book.favorite && (
            <Heart className="heart" size={17} fill="currentColor" />
          )}
          <span className="cover-mark">ARCADIA · AI TEXTBOOK</span>
        </div>
        <div className="book-meta">
          <strong>{book.title}</strong>
          <span>
            {["ready", "completed"].includes(book.generationStatus ?? "")
              ? `${book.generatedChapterCount ?? book.chapterIds.length}/${book.outline?.chapters.length ?? book.chapterIds.length}章生成済み · ${book.progress}% 読了`
              : book.generationStatus === "awaiting_approval"
                ? "構成の確認待ち"
                : "生成状況を確認中"}
          </span>
          {showGenerationConditions && (book.level || book.purpose) && (
            <div className="book-conditions">
              {book.level && <span>難易度：{book.level}</span>}
              {book.purpose && <span>目的：{book.purpose}</span>}
            </div>
          )}
          <Progress value={book.progress} />
        </div>
      </Link>
      {(onRegenerate || onDelete) && (
        <div className="book-actions" ref={menuRef}>
          <button
            type="button"
            className="book-menu-trigger"
            aria-label={`${book.title}の操作メニュー`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <div className="book-menu" role="menu">
              {onRegenerate && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={book.generationStatus !== "completed"}
                  onClick={() => {
                    setMenuOpen(false);
                    onRegenerate();
                  }}
                >
                  <RefreshCw size={16} />
                  条件を変えて再生成
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  disabled={
                    deleting ||
                    ![
                      "ready",
                      "completed",
                      "failed",
                      "awaiting_approval",
                    ].includes(book.generationStatus ?? "")
                  }
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={16} />
                  {deleting ? "削除中…" : "削除"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
