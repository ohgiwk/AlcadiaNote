import { describe, expect, it } from "vitest";
import type { Page } from "../../types/models";
import { getReadingProgressState } from "./useReadingProgress";

const pages = Array.from({ length: 5 }, (_, index) => ({
  id: `page-${index + 1}`,
  order: index + 1,
})) as Page[];

describe("getReadingProgressState", () => {
  it("uses the furthest of the current and saved pages", () => {
    expect(
      getReadingProgressState({
        pages,
        currentPageId: "page-2",
        savedPageId: "page-4",
        totalPageCount: 5,
      }),
    ).toMatchObject({ completedPageIndex: 3, percent: 80, progressPage: pages[3] });
  });

  it("handles missing pages and an empty textbook without negative progress", () => {
    expect(
      getReadingProgressState({
        pages: [],
        currentPageId: "missing",
        savedPageId: "missing",
        totalPageCount: 0,
      }),
    ).toEqual({ completedPageIndex: -1, percent: 0, progressPage: undefined });
  });

  it("caps progress at one hundred when generated pages exceed the outline count", () => {
    expect(
      getReadingProgressState({
        pages,
        currentPageId: "page-5",
        totalPageCount: 3,
      }).percent,
    ).toBe(100);
  });
});
