import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Chapter, Page } from "../../types/models";

export function ReaderFooter({
  textbookId,
  pages,
  pageIndex,
  currentChapter,
  isChapterEnd,
  onNavigate,
}: {
  textbookId: string;
  pages: Page[];
  pageIndex: number;
  currentChapter?: Chapter;
  isChapterEnd: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <footer className="page-nav">
      <button
        disabled={pageIndex <= 0}
        onClick={() =>
          pageIndex > 0 &&
          onNavigate(`/textbooks/${textbookId}/read/${pages[pageIndex - 1].id}`)
        }
      >
        <ChevronLeft />
        前のページ
      </button>
      <span>
        {pageIndex + 1} / {pages.length}
      </span>
      <button
        disabled={pageIndex < 0}
        onClick={() => {
          if (isChapterEnd && currentChapter) {
            onNavigate(
              `/textbooks/${textbookId}/chapters/${currentChapter.id}/quiz`,
            );
          } else if (pageIndex < pages.length - 1) {
            onNavigate(
              `/textbooks/${textbookId}/read/${pages[pageIndex + 1].id}`,
            );
          }
        }}
      >
        {isChapterEnd ? "章末問題へ" : "次のページ"}
        <ChevronRight />
      </button>
    </footer>
  );
}
