import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { BookCover } from "../components/BookCover";
import { useCollection } from "../hooks/useFirestoreData";
import type { Textbook, UserProgress } from "../types/models";
export function HomePage() {
  const { user } = useAuth();
  const { data: books } = useCollection<Textbook>("textbooks", {
    enabled: Boolean(user),
    filters: user ? [["ownerId", "==", user.uid]] : [],
  });
  const { data: progressEntries } = useCollection<UserProgress>(
    `users/${user?.uid}/progress`,
    {
      enabled: Boolean(user),
      filters: user ? [["ownerId", "==", user.uid]] : [],
    },
  );
  const progressByTextbook = new Map(
    progressEntries.map((entry) => [entry.textbookId, entry]),
  );
  const ready = books.find(
    (x) =>
      ["ready", "completed"].includes(x.generationStatus ?? "") &&
      x.firstPageId,
  );
  return (
    <div className="page home">
      <section className="welcome">
        <div>
          <span className="eyebrow">ARCADIA AI TEXTBOOK</span>
          <h1>おかえりなさい。</h1>
          <p>好奇心から、次の一冊を育てましょう。</p>
        </div>
        <Link className="button primary" to="/create">
          <Plus size={18} />
          新しい教科書を作る
        </Link>
      </section>
      {ready && (
        <section className="continue-card">
          <div className={`mini-cover ${ready.cover}`} />
          <div className="continue-copy">
            <span className="eyebrow">続きから読む</span>
            <h2>{ready.title}</h2>
            <p>{ready.subtitle}</p>
          </div>
          <Link
            to={`/textbooks/${ready.id}/read/${progressByTextbook.get(ready.id)?.pageId ?? ready.firstPageId}`}
            className="round-link"
          >
            <ArrowRight />
          </Link>
        </section>
      )}
      <section className="section-head">
        <div>
          <span className="eyebrow">YOUR LIBRARY</span>
          <h2>最近の教科書</h2>
        </div>
        <Link to="/library">
          すべて見る <ArrowRight size={16} />
        </Link>
      </section>
      {books.length ? (
        <div className="book-grid">
          {books.slice(0, 3).map((x) => (
            <BookCover
              key={x.id}
              book={{
                ...x,
                progress: progressByTextbook.get(x.id)?.percent ?? 0,
              }}
            />
          ))}
        </div>
      ) : (
        <p>
          まだ教科書がありません。テーマを入力して最初の一冊を作成してください。
        </p>
      )}
    </div>
  );
}
