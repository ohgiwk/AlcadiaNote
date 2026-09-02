import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "server-time"),
}));

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  deleteDoc: mocks.deleteDoc,
  doc: (...args: unknown[]) => {
    if (args.length === 1) return { path: `auto/${crypto.randomUUID()}` };
    return { path: String(args.at(-1)) };
  },
  getDocs: mocks.getDocs,
  query: (source: unknown) => source,
  runTransaction: mocks.runTransaction,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
  updateDoc: mocks.updateDoc,
  where: (...args: unknown[]) => args,
}));

vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("../firebase", () => ({ db: {}, functions: {} }));

import {
  rateFlashcard,
  savePageNote,
  saveProgress,
  toggleBookmark,
} from "./firebaseService";

describe("firebase learning state writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a deterministic bookmark id so concurrent creates cannot duplicate it", async () => {
    mocks.getDocs.mockResolvedValue({ empty: true, docs: [] });
    await toggleBookmark("user-1", "book-1", "page-1");

    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: "users/user-1/bookmarks/book-1__page-1" },
      expect.objectContaining({
        ownerId: "user-1",
        textbookId: "book-1",
        pageId: "page-1",
      }),
    );
  });

  it("removes every legacy duplicate bookmark", async () => {
    const first = { id: "first" };
    const second = { id: "second" };
    mocks.getDocs.mockResolvedValue({ empty: false, docs: [{ ref: first }, { ref: second }] });

    await expect(toggleBookmark("user-1", "book-1", "page-1")).resolves.toBe(false);
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(2);
    expect(mocks.deleteDoc).toHaveBeenCalledWith(first);
    expect(mocks.deleteDoc).toHaveBeenCalledWith(second);
  });

  it("does not lower saved progress unless explicitly requested", async () => {
    const update = vi.fn();
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => true, data: () => ({ percent: 80 }) }),
        update,
        set: vi.fn(),
      }),
    );

    await saveProgress("user-1", "book-1", "page-2", 40);
    expect(update).toHaveBeenCalledWith(
      { path: "users/user-1/progress/book-1" },
      { updatedAt: "server-time" },
    );
  });

  it("creates a deterministic page note and updates an existing note", async () => {
    await savePageNote("user-1", "book-1", "page-1", "new note");
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { path: "users/user-1/notes/book-1__page-1" },
      expect.objectContaining({
        ownerId: "user-1",
        text: "new note",
        createdAt: "server-time",
      }),
    );

    await savePageNote("user-1", "book-1", "page-1", "updated", "note-9");
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1/notes/note-9" },
      { text: "updated", quote: "", updatedAt: "server-time" },
    );
  });

  it("preserves flashcard createdAt on later ratings", async () => {
    const update = vi.fn();
    const set = vi.fn();
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => true }),
        update,
        set,
      }),
    );

    await rateFlashcard("user-1", "book-1", "card-1", 4);
    expect(update).toHaveBeenCalledWith(
      { path: "users/user-1/flashcardProgress/card-1" },
      expect.not.objectContaining({ createdAt: expect.anything() }),
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("sets flashcard createdAt on the first rating", async () => {
    const update = vi.fn();
    const set = vi.fn();
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => false }),
        update,
        set,
      }),
    );

    await rateFlashcard("user-1", "book-1", "card-1", 2);
    expect(set).toHaveBeenCalledWith(
      { path: "users/user-1/flashcardProgress/card-1" },
      expect.objectContaining({ mastery: 2, createdAt: "server-time" }),
    );
    expect(update).not.toHaveBeenCalled();
  });
});
