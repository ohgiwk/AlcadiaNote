import { Check, ChevronRight, RotateCcw, Trophy, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { Progress } from "../components/ui";
import { useTextbook } from "../hooks/useTextbook";
import { saveQuizAttempt } from "../services/firebaseService";
export function QuizPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { book, quizzes, loading } = useTextbook(id);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  if (loading) return <div className="page">問題を読み込んでいます…</div>;
  const done = index >= quizzes.length;
  if (!quizzes.length) return <div className="page">問題がありません。</div>;
  if (done)
    return (
      <div className="page result">
        <div className="trophy">
          <Trophy />
        </div>
        <span className="eyebrow">SESSION COMPLETE</span>
        <h1>よくできました。</h1>
        <strong>
          {score} / {quizzes.length}
        </strong>
        <Progress value={Math.round((score / quizzes.length) * 100)} />
        <div>
          <Link className="button primary" to={`/textbooks/${id}/flashcards`}>
            暗記カードで復習
          </Link>
          <button
            className="button"
            onClick={() => {
              setIndex(0);
              setScore(0);
              setChecked(false);
              setSelected("");
            }}
          >
            <RotateCcw />
            もう一度
          </button>
        </div>
      </div>
    );
  const q = quizzes[index];
  const correct = selected === q.answer || q.type === "written";
  return (
    <div className="quiz-page">
      <header>
        <Link to={`/textbooks/${id}/read/${book?.firstPageId}`}>
          ← 教科書へ
        </Link>
        <span>章末チェック</span>
        <strong>
          {index + 1} / {quizzes.length}
        </strong>
      </header>
      <Progress value={((index + 1) / quizzes.length) * 100} />
      <main>
        <span className="eyebrow">
          QUESTION {String(index + 1).padStart(2, "0")}
        </span>
        <h1>{q.prompt}</h1>
        {q.type === "written" ? (
          <textarea
            className="written-answer"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            placeholder="自分の言葉で説明してみましょう…"
          />
        ) : (
          <div className="answers">
            {q.options?.map((x, i) => (
              <button
                disabled={checked}
                onClick={() => setSelected(x)}
                className={`${selected === x ? "selected" : ""} ${checked && x === q.answer ? "correct" : ""} ${checked && selected === x && x !== q.answer ? "wrong" : ""}`}
                key={x}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {x}
                {checked && x === q.answer && <Check />}
                {checked && selected === x && x !== q.answer && <X />}
              </button>
            ))}
          </div>
        )}
        {checked && (
          <aside className={correct ? "feedback correct" : "feedback"}>
            <strong>{correct ? "正解です" : "もう一度確認しましょう"}</strong>
            <p>{q.explanation}</p>
          </aside>
        )}
        <button
          className="button primary quiz-next"
          disabled={!selected}
          onClick={() => {
            if (!checked) {
              setChecked(true);
              if (correct) setScore((s) => s + 1);
              if (user)
                void saveQuizAttempt(user.uid, id, q.id, selected, correct);
            } else {
              setIndex((i) => i + 1);
              setSelected("");
              setChecked(false);
            }
          }}
        >
          {checked ? "次の問題" : "答えを確認"}
          <ChevronRight />
        </button>
      </main>
    </div>
  );
}
