import { BookOpen, Check, ChevronRight, Clock3, Sparkles } from "lucide-react";
import type {
  GenerationJob,
  TextbookGenerationInput,
} from "../../types/models";
import { withoutInlineLinks, withoutPageNumberPrefix } from "../../utils/text";

const labels: Record<string, string> = {
  queued: "準備しています",
  researching: "信頼できる情報源を調査しています",
  outlining: "学習ロードマップを設計しています",
  awaiting_approval: "ロードマップの確認を待っています",
  approved: "本文生成を開始しています",
  writing: "章とページを書いています",
  finalizing: "問題とカードを仕上げています",
  completed: "完成しました",
  failed: "生成に失敗しました",
};

const generationStages = [
  { status: "researching", label: labels.researching },
  { status: "outlining", label: labels.outlining },
  { status: "writing", label: labels.writing },
  { status: "finalizing", label: labels.finalizing },
] as const;

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes
    ? `${minutes}分${rest.toString().padStart(2, "0")}秒`
    : `${rest}秒`;
}

export function OutlineReview({
  job,
  error,
  approving,
  onApprove,
  onLater,
}: {
  job: GenerationJob & { outline: NonNullable<GenerationJob["outline"]> };
  error: string;
  approving: boolean;
  onApprove: () => void;
  onLater: () => void;
}) {
  return (
    <div className="page outline-review" aria-live="polite">
      <header className="outline-review-header">
        <span className="eyebrow">REVIEW THE ROADMAP</span>
        <h1>{withoutInlineLinks(job.outline.title)}</h1>
        <p>{withoutInlineLinks(job.outline.subtitle)}</p>
        <div className="generation-conditions">
          <span>難易度：{job.input.level}</span>
          <span>目的：{job.input.purpose}</span>
          <span>全4章・12ページ</span>
        </div>
      </header>
      <section className="outline-review-list">
        {job.outline.chapters.map((chapter, chapterIndex) => (
          <article
            className="outline-chapter"
            key={`${chapterIndex}-${chapter.title}`}
          >
            <div className="outline-chapter-number">{chapterIndex + 1}</div>
            <div>
              <h2>{withoutInlineLinks(chapter.title)}</h2>
              <p>{withoutInlineLinks(chapter.summary)}</p>
              <ol>
                {chapter.pages.map((page, pageIndex) => (
                  <li key={`${pageIndex}-${page.title}`}>
                    <strong>
                      {withoutPageNumberPrefix(withoutInlineLinks(page.title))}
                    </strong>
                    <span>{withoutInlineLinks(page.summary)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        ))}
      </section>
      {error && <p className="error">{error}</p>}
      <div className="outline-review-actions">
        <button type="button" className="button secondary" onClick={onLater}>
          あとで確認する
        </button>
        <button
          type="button"
          className="button primary"
          disabled={approving}
          onClick={onApprove}
        >
          {approving ? "承認中…" : "この構成で本文を生成"}
          {!approving && <ChevronRight size={18} />}
        </button>
      </div>
      <p className="outline-review-note">
        承認するまで本文生成は開始されません。目次は本棚から再度確認できます。
      </p>
    </div>
  );
}

export function GenerationProgress({
  job,
  loading,
  fallbackInput,
  elapsed,
  onRetryChapter,
  onReset,
}: {
  job: GenerationJob | null;
  loading: boolean;
  fallbackInput: TextbookGenerationInput;
  elapsed: number;
  onRetryChapter: () => void;
  onReset: () => void;
}) {
  const status = job?.status ?? "queued";
  const progress = job?.progress ?? 0;
  const displayedStage =
    status === "failed"
      ? job?.failedAtStage
      : status === "approved"
        ? "writing"
        : status;
  const activeStage = generationStages.findIndex(
    (stage) => stage.status === displayedStage,
  );
  return (
    <div className="generation" aria-live="polite">
      <section className="generation-card">
        <div className="generation-orbit">
          <Sparkles />
          <i />
          <i />
        </div>
        <span className="eyebrow">BUILDING YOUR TEXTBOOK</span>
        <h1>
          {status === "failed"
            ? "生成を完了できませんでした"
            : status === "completed"
              ? "教科書が完成しました"
              : loading
                ? "生成ジョブへ接続しています"
                : labels[status]}
        </h1>
        <p>「{job?.input.topic ?? fallbackInput.topic}」</p>
        <div className="generation-live-status">
          <div className="generation-progress-heading">
            <strong>{progress}%</strong>
            <span>
              <Clock3 size={15} /> {formatElapsed(elapsed)}経過
            </span>
          </div>
          <div
            className="generation-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>{job?.stageDetail ?? labels[status]}</p>
          <small>進捗率は現在の工程をもとにした目安です</small>
        </div>
        <div className="generation-conditions">
          <span>難易度：{job?.input.level ?? fallbackInput.level}</span>
          <span>目的：{job?.input.purpose ?? fallbackInput.purpose}</span>
        </div>
        <div className="generation-steps">
          {generationStages.map((stage, index) => {
            const completed =
              status === "completed" ||
              (activeStage >= 0 && index < activeStage);
            const current = index === activeStage;
            return (
              <div
                className={completed ? "done" : current ? "current" : ""}
                key={stage.status}
              >
                {completed ? <Check /> : <span>{index + 1}</span>}
                <div>
                  <strong>{stage.label}</strong>
                  {current && job?.stageDetail && (
                    <small>
                      {status === "failed"
                        ? `${stage.label}の途中で停止しました`
                        : job.stageDetail}
                    </small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {status !== "completed" && status !== "failed" && (
          <p className="generation-background-note">
            この画面を閉じても生成は継続します。URLを再度開くと進捗を復元できます。
          </p>
        )}
        {status === "failed" && (
          <button
            className="button primary"
            onClick={job?.jobType === "chapter" ? onRetryChapter : onReset}
          >
            {job?.jobType === "chapter"
              ? `第${job.chapterOrder ?? 1}章を再試行`
              : "条件を確認してもう一度試す"}
          </button>
        )}
      </section>
    </div>
  );
}

export function GenerationForm({
  input,
  regeneration,
  firebaseConfigured,
  authenticated,
  authError,
  error,
  onChange,
  onGenerate,
}: {
  input: TextbookGenerationInput;
  regeneration: Partial<TextbookGenerationInput> | null;
  firebaseConfigured: boolean;
  authenticated: boolean;
  authError: string;
  error: string;
  onChange: (input: TextbookGenerationInput) => void;
  onGenerate: () => void;
}) {
  const regenerating = Boolean(regeneration?.sourceTextbookId);
  return (
    <div className="page create-page">
      <div className="create-intro">
        <div className="create-mark">
          <BookOpen />
          <Sparkles />
        </div>
        <span className="eyebrow">CREATE WITH AI</span>
        <h1>
          {regenerating
            ? "どんな学び方に変えますか？"
            : "次は、何を学びますか？"}
        </h1>
        <p>
          {regenerating
            ? "元の一冊を残したまま、難易度と目的を変えて新しい版を作ります。"
            : "ひとつのテーマから、あなただけの教科書を育てます。"}
        </p>
      </div>
      <section className="create-form">
        <label className="topic-label">
          <span>学びたいテーマ</span>
          <textarea
            maxLength={300}
            value={input.topic}
            onChange={(event) =>
              onChange({ ...input, topic: event.target.value })
            }
            readOnly={regenerating}
            placeholder="例：産業革命は社会をどう変えた？"
          />
          <small>
            {regenerating
              ? "再生成では元の教科書と同じテーマを引き継ぎます。"
              : "テーマ、疑問、目標など、自由に書いてください。"}
          </small>
        </label>
        <fieldset>
          <legend>難易度</legend>
          <div className="choice-row">
            {(["初心者", "中級", "上級", "AIに任せる"] as const).map(
              (level) => (
                <button
                  type="button"
                  onClick={() => onChange({ ...input, level })}
                  className={input.level === level ? "selected" : ""}
                  key={level}
                >
                  {level}
                </button>
              ),
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend>学ぶ目的</legend>
          <div className="choice-row">
            {(["趣味", "仕事", "資格", "教養"] as const).map((purpose) => (
              <button
                type="button"
                onClick={() => onChange({ ...input, purpose })}
                className={input.purpose === purpose ? "selected" : ""}
                key={purpose}
              >
                {purpose}
              </button>
            ))}
          </div>
        </fieldset>
        {!firebaseConfigured && (
          <p className="form-error">
            Firebase接続情報を.env.localに設定すると生成を開始できます。
          </p>
        )}
        {authError && (
          <p className="form-error">
            Firebase Authenticationエラー: {authError}
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
        <button
          className="generate-button"
          disabled={
            !firebaseConfigured ||
            !authenticated ||
            input.topic.trim().length < 2
          }
          onClick={onGenerate}
        >
          <Sparkles />
          {regenerating ? "この条件で再生成する" : "教科書を生成する"}
          <ChevronRight />
        </button>
        <p className="form-note">
          まず目次を作成し、承認後に第1章を生成します。第2章以降は好きなタイミングで追加できます。
        </p>
      </section>
    </div>
  );
}
