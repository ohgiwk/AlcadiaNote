import { Check, ChevronRight, RotateCcw, Trophy, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { Progress } from "../components/ui";
import { useTextbook } from "../hooks/useTextbook";
import {
  requestNextChapterGeneration,
  saveQuizAttempt,
} from "../services/firebaseService";
export function QuizPage() {
  const { id = "", chapterId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { book, chapters, quizzes, loading } = useTextbook(id);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [generatingNext, setGeneratingNext] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const chapter = chapters.find((item) => item.id === chapterId);
  const chapterQuizzes = quizzes
    .filter(
      (quiz) =>
        !chapterId ||
        quiz.chapterId === chapterId ||
        (!quiz.chapterId &&
          Boolean(quiz.pageId && chapter?.pageIds.includes(quiz.pageId))),
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nextChapter = chapter
    ? chapters.find((item) => item.order === chapter.order + 1)
    : undefined;
  async function generateNextChapter() {
    if (!id || !nextChapter) return;
    setGeneratingNext(true);
    setGenerationError("");
    try {
      await requestNextChapterGeneration(id);
      navigate(
        `/textbooks/${id}/read/${chapter?.pageIds.at(-1) ?? book?.firstPageId}`,
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "次の章を生成できませんでした",
      );
      setGeneratingNext(false);
    }
  }
  if (loading) return <div className="page">問題を読み込んでいます…</div>;
  const done = index >= chapterQuizzes.length;
  if (!chapterQuizzes.length)
    return (
      <div className="page result">
        <h1>この章の確認問題はまだありません。</h1>
        <p>既存の教科書は、再生成すると各章5問の形式になります。</p>
        <Link
          className="button primary"
          to={`/textbooks/${id}/read/${chapter?.pageIds.at(-1) ?? book?.firstPageId}`}
        >
          教科書へ戻る
        </Link>
      </div>
    );
  if (done)
    return (
      <div className="page result">
        <div className="trophy">
          <Trophy />
        </div>
        <span className="eyebrow">SESSION COMPLETE</span>
        <h1>よくできました。</h1>
        <strong>
          {score} / {chapterQuizzes.length}
        </strong>
        <Progress value={Math.round((score / chapterQuizzes.length) * 100)} />
        <div>
          {nextChapter?.pageIds[0] ? (
            <Link
              className="button primary"
              to={`/textbooks/${id}/read/${nextChapter.pageIds[0]}`}
            >
              次の章へ進む
            </Link>
          ) : nextChapter ? (
            <button
              className="button primary"
              disabled={generatingNext}
              onClick={generateNextChapter}
            >
              {generatingNext
                ? `第${nextChapter.order}章を生成中…`
                : nextChapter.generationStatus === "failed"
                  ? `第${nextChapter.order}章を再試行`
                  : `第${nextChapter.order}章を生成`}
            </button>
          ) : (
            <Link className="button primary" to={`/textbooks/${id}/flashcards`}>
              暗記カードで復習
            </Link>
          )}
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
        {generationError && <p className="error">{generationError}</p>}
      </div>
    );
  const q = chapterQuizzes[index];
  const correct =
    selected.trim().toLocaleLowerCase("ja") ===
    q.answer.trim().toLocaleLowerCase("ja");
  return (
    <div className="quiz-page">
      <header>
        <Link
          to={`/textbooks/${id}/read/${chapter?.pageIds.at(-1) ?? book?.firstPageId}`}
        >
          ← 教科書へ
        </Link>
        <span>
          {chapter ? `第${chapter.order}章 章末チェック` : "章末チェック"}
        </span>
        <strong>
          {index + 1} / {chapterQuizzes.length}
        </strong>
      </header>
      <Progress value={((index + 1) / chapterQuizzes.length) * 100} />
      <main>
        <span className="eyebrow">
          QUESTION {String(index + 1).padStart(2, "0")}
        </span>
        <h1>{q.prompt}</h1>
        {q.type === "written" ? (
          <textarea
            className="written-answer"
            value={selected}
            disabled={checked}
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
            <p className="correct-answer">
              <b>正解：</b>
              {q.answer}
            </p>
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
          {checked
            ? index === chapterQuizzes.length - 1
              ? "結果を確認"
              : "次の問題"
            : "答えを確認"}
          <ChevronRight />
        </button>
      </main>
    </div>
  );
}
