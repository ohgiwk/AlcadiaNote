import { useEffect } from "react";
import { saveProgress } from "../../services/firebaseService";
import type { Page } from "../../types/models";

export function useReadingProgress(options: {
  uid?: string;
  textbookId: string;
  page?: Page;
  pageIndex: number;
  pageCount: number;
}) {
  const { uid, textbookId, page, pageIndex, pageCount } = options;

  useEffect(() => {
    document.querySelector(".reader-scroll")?.scrollTo(0, 0);
    if (!uid || !page || !pageCount) return;
    void saveProgress(
      uid,
      textbookId,
      page.id,
      Math.round(((pageIndex + 1) / pageCount) * 100),
    );
  }, [page, pageCount, pageIndex, textbookId, uid]);
}
