import { useEffect } from "react";
import { saveProgress } from "../../services/firebaseService";
import type { Page, UserProgress } from "../../types/models";

export function getReadingProgressState(options: {
  pages: Page[];
  currentPageId?: string;
  savedPageId?: string;
  totalPageCount: number;
}) {
  const { pages, currentPageId, savedPageId, totalPageCount } = options;
  const currentPageIndex = pages.findIndex((page) => page.id === currentPageId);
  const savedPageIndex = pages.findIndex((page) => page.id === savedPageId);
  const completedPageIndex = Math.max(currentPageIndex, savedPageIndex);
  const progressPage = pages[completedPageIndex];
  const percent = totalPageCount
    ? Math.min(
        100,
        Math.round(((completedPageIndex + 1) / totalPageCount) * 100),
      )
    : 0;

  return { completedPageIndex, percent, progressPage };
}

export function useReadingProgress(options: {
  uid?: string;
  textbookId: string;
  page?: Page;
  pages: Page[];
  totalPageCount: number;
  savedProgress?: UserProgress | null;
}) {
  const { uid, textbookId, page, pages, totalPageCount, savedProgress } =
    options;
  const savedPageId = savedProgress?.pageId;

  useEffect(() => {
    document.querySelector(".reader-scroll")?.scrollTo(0, 0);
    if (!uid || !page || !totalPageCount) return;

    const progress = getReadingProgressState({
      pages,
      currentPageId: page.id,
      savedPageId,
      totalPageCount,
    });
    const progressPage = progress.progressPage ?? page;

    void saveProgress(uid, textbookId, progressPage.id, progress.percent);
  }, [page, pages, savedPageId, textbookId, totalPageCount, uid]);
}
