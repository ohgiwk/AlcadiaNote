import { CheckCircle2, ListChecks, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { generateChapterQuizzes } from "../../services/firebaseService";
import type { Chapter, Quiz } from "../../types/models";

export function QuizGeneratorPanel({
  textbookId,
  chapter,
  quizzes,
}: {
  textbookId: string;
  chapter?: Chapter;
  quizzes: Quiz[];
}) {
  const [questionCount, setQuestionCount] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const chapterQuizzes = chapter
    ? quizzes.filter((quiz) => quiz.chapterId === chapter.id)
    : [];
  const generating =
    submitting || chapter?.quizGenerationStatus === "generating";

  async function generate() {
    if (!chapter || generating) return;
    setError("");
    setSubmitting(true);
    try {
      await generateChapterQuizzes({
        textbookId,
        chapterId: chapter.id,
        questionCount,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "問題を生成できませんでした",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="quiz-generator-panel">
      <header>
        <span>
          <ListChecks size={18} />
          問題集
        </span>
        <i>
          {chapter ? `第${chapter.order}章を参照中` : "章を選択してください"}
        </i>
      </header>
      <div className="quiz-generator-content">
        <div className="quiz-generator-summary">
          <ListChecks size={24} />
          <div>
            <strong>{chapter?.title ?? "章が見つかりません"}</strong>
            <span>現在 {chapterQuizzes.length} 問</span>
          </div>
        </div>
        <p>この章の本文から、選択式または正誤式の確認問題を作成します。</p>
        <label>
          <span>問題数</span>
          <input
            type="number"
            min={1}
            max={20}
            value={questionCount}
            disabled={generating}
            onChange={(event) => {
              const value = Number(event.target.value);
              setQuestionCount(
                Math.min(20, Math.max(1, Number.isFinite(value) ? value : 1)),
              );
            }}
          />
          <small>1〜20問</small>
        </label>
        {chapterQuizzes.length > 0 && (
          <div className="quiz-generator-warning">
            再生成すると、この章の既存問題は置き換わります。
          </div>
        )}
        {error && (
          <div className="quiz-generator-error" role="alert">
            {error}
          </div>
        )}
        {chapter?.quizGenerationStatus === "completed" &&
          !generating &&
          chapterQuizzes.length > 0 && (
            <div className="quiz-generator-success">
              <CheckCircle2 size={16} />
              問題を生成しました
            </div>
          )}
        <button
          type="button"
          className="button primary"
          disabled={
            !chapter || chapter.generationStatus !== "completed" || generating
          }
          onClick={() => void generate()}
        >
          {generating ? (
            <>
              <LoaderCircle className="spin" size={17} />
              生成中…
            </>
          ) : (
            `${questionCount}問を生成`
          )}
        </button>
        {chapterQuizzes.length > 0 && chapter && (
          <Link
            className="button"
            to={`/textbooks/${textbookId}/chapters/${chapter.id}/quiz`}
          >
            問題を解く
          </Link>
        )}
      </div>
    </aside>
  );
}
