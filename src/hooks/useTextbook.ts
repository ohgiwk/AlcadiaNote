import { orderBy } from "firebase/firestore";
import { useCollection, useDocument } from "./useFirestoreData";
import type { Chapter, Flashcard, Page, Quiz, Textbook } from "../types/models";
export function useTextbook(id?: string) {
  const book = useDocument<Textbook>(id ? `textbooks/${id}` : undefined);
  const chapters = useCollection<Chapter>(
    id ? `textbooks/${id}/chapters` : "__none__",
    [orderBy("order", "asc")],
  );
  const pages = useCollection<Page>(id ? `textbooks/${id}/pages` : "__none__", [
    orderBy("order", "asc"),
  ]);
  const quizzes = useCollection<Quiz>(
    id ? `textbooks/${id}/quizzes` : "__none__",
  );
  const flashcards = useCollection<Flashcard>(
    id ? `textbooks/${id}/flashcards` : "__none__",
  );
  return {
    book: book.data,
    chapters: chapters.data,
    pages: pages.data,
    quizzes: quizzes.data,
    flashcards: flashcards.data,
    loading:
      book.loading || chapters.loading || pages.loading || quizzes.loading,
  };
}
