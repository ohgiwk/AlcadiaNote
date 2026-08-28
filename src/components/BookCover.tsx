import { BookOpen, Heart, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Textbook } from "../types/models";
import { Progress } from "./ui";
export function BookCover({
  book,
  compact = false,
  onDelete,
  onRegenerate,
  deleting = false,
}: {
  book: Textbook;
  compact?: boolean;
  onDelete?: () => void;
  onRegenerate?: () => void;
  deleting?: boolean;
}) {
  const ready = book.generationStatus === "completed" && book.firstPageId;
  const needsApproval =
    book.generationStatus === "awaiting_approval" && book.generationJobId;
  return (
    <article className="book-card-container">
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
                  : book.generationStatus !== "completed"
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
            {book.generationStatus === "completed"
              ? `${book.progress}% 読了`
              : book.generationStatus === "awaiting_approval"
                ? "構成の確認待ち"
                : "生成状況を確認中"}
          </span>
          <Progress value={book.progress} />
        </div>
      </Link>
      {(onRegenerate || onDelete) && (
        <div className="book-actions">
          {onRegenerate && (
            <button
              type="button"
              className="book-regenerate"
              disabled={book.generationStatus !== "completed"}
              onClick={onRegenerate}
            >
              <RefreshCw size={16} />
              条件を変えて再生成
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="book-delete"
              disabled={
                deleting ||
                !["completed", "failed", "awaiting_approval"].includes(
                  book.generationStatus ?? "",
                )
              }
              onClick={onDelete}
              aria-label={`${book.title}を削除`}
            >
              <Trash2 size={16} />
              {deleting ? "削除中…" : "削除"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
