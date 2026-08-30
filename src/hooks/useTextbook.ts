import { useCollection, useDocument } from "./useFirestoreData";
import type { Chapter, Flashcard, Page, Quiz, Textbook } from "../types/models";
export function useTextbook(id?: string) {
  const book = useDocument<Textbook>(id ? `textbooks/${id}` : undefined);
  const chapters = useCollection<Chapter>(`textbooks/${id}/chapters`, {
    enabled: Boolean(id),
    order: ["order", "asc"],
  });
  const pages = useCollection<Page>(`textbooks/${id}/pages`, {
    enabled: Boolean(id),
    order: ["order", "asc"],
  });
  const quizzes = useCollection<Quiz>(`textbooks/${id}/quizzes`, {
    enabled: Boolean(id),
  });
  const flashcards = useCollection<Flashcard>(`textbooks/${id}/flashcards`, {
    enabled: Boolean(id),
  });
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
