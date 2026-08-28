import { Brain, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useTextbook } from "../hooks/useTextbook";
import { rateFlashcard } from "../services/firebaseService";
export function FlashcardsPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { book, flashcards, loading } = useTextbook(id);
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState(false);
  const [done, setDone] = useState(false);
  if (loading) return <div className="page">カードを読み込んでいます…</div>;
  if (!flashcards.length)
    return <div className="page">暗記カードがありません。</div>;
  const card = flashcards[index];
  const rate = (mastery: number) => {
    if (user) void rateFlashcard(user.uid, id, card.id, mastery);
    if (index === flashcards.length - 1) setDone(true);
    else {
      setIndex((i) => i + 1);
      setFlip(false);
    }
  };
  if (done)
    return (
      <div className="flash-page complete">
        <Brain />
        <h1>今日の復習は完了です</h1>
        <p>{flashcards.length}枚のカードを復習しました。</p>
        <Link className="button primary" to="/dashboard">
          学習記録を見る
        </Link>
      </div>
    );
  return (
    <div className="flash-page">
      <header>
        <Link to={`/textbooks/${id}/read/${book?.firstPageId}`}>
          ← 教科書へ
        </Link>
        <span>復習カード</span>
        <strong>
          {index + 1} / {flashcards.length}
        </strong>
      </header>
      <div className="flash-progress">
        {flashcards.map((_, i) => (
          <span className={i <= index ? "active" : ""} key={i} />
        ))}
      </div>
      <p className="flash-hint">
        <RotateCcw size={15} />
        カードをタップして答えを見る
      </p>
      <button
        className={`flashcard ${flip ? "flipped" : ""}`}
        onClick={() => setFlip(!flip)}
      >
        <span>{flip ? "ANSWER" : "QUESTION"}</span>
        <h1>{flip ? card.back : card.front}</h1>
      </button>
      <div className={`rating ${flip ? "show" : ""}`}>
        <p>このカードの理解度は？</p>
        <div>
          {["もう一度", "むずかしい", "わかった", "簡単"].map((x, i) => (
            <button key={x} onClick={() => rate(i)}>
              <span>{x}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
