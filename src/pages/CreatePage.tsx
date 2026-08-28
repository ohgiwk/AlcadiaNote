import { BookOpen, Check, ChevronRight, Clock3, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useDocument } from "../hooks/useFirestoreData";
import { firebaseConfigured } from "../firebase";
import {
  approveTextbookOutline,
  createTextbook,
} from "../services/firebaseService";
import type { GenerationJob, TextbookGenerationInput } from "../types/models";
import { withoutInlineLinks } from "../utils/text";
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

export function CreatePage() {
  const location = useLocation();
  const regeneration =
    location.state as Partial<TextbookGenerationInput> | null;
  const { user, error: authError } = useAuth();
  const [topic, setTopic] = useState(
    regeneration?.topic ?? "産業革命と近代社会",
  );
  const [level, setLevel] = useState<TextbookGenerationInput["level"]>(
    regeneration?.level ?? "AIに任せる",
  );
  const [purpose, setPurpose] = useState<TextbookGenerationInput["purpose"]>(
    regeneration?.purpose ?? "教養",
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobId, setJobId] = useState(() => searchParams.get("job") ?? "");
  const [clock, setClock] = useState(0);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const nav = useNavigate();
  const { data: job, loading: jobLoading } = useDocument<GenerationJob>(
    jobId ? `generationJobs/${jobId}` : undefined,
  );
  useEffect(() => {
    if (!jobId) return;
    const initialTimer = window.setTimeout(() => setClock(Date.now()), 0);
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [jobId]);
  useEffect(() => {
    if (job?.status !== "completed" || !job.firstPageId) return;
    const timer = window.setTimeout(
      () => nav(`/textbooks/${job.textbookId}/read/${job.firstPageId}`),
      900,
    );
    return () => window.clearTimeout(timer);
  }, [job, nav]);
  async function generate() {
    setError("");
    try {
      const result = await createTextbook({
        topic: topic.trim(),
        level,
        purpose,
        sourceTextbookId: regeneration?.sourceTextbookId,
      });
      setJobId(result.jobId);
      setSearchParams({ job: result.jobId }, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成を開始できませんでした");
    }
  }
  async function approveOutline() {
    setError("");
    setApproving(true);
    try {
      await approveTextbookOutline(jobId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "承認を受け付けられませんでした",
      );
    } finally {
      setApproving(false);
    }
  }
  if (jobId) {
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
    const startedAt = job?.startedAt || job?.createdAt;
    const startedAtTime = startedAt
      ? new Date(startedAt).getTime()
      : Number.NaN;
    const elapsed = Number.isFinite(startedAtTime)
      ? Math.max(0, Math.floor((clock - startedAtTime) / 1000))
      : Math.max(0, job?.elapsedSeconds ?? 0);
    if (status === "awaiting_approval" && job?.outline) {
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
                        <strong>{withoutInlineLinks(page.title)}</strong>
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
            <button
              type="button"
              className="button secondary"
              onClick={() => nav("/library")}
            >
              あとで確認する
            </button>
            <button
              type="button"
              className="button primary"
              disabled={approving}
              onClick={approveOutline}
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
                : jobLoading
                  ? "生成ジョブへ接続しています"
                  : labels[status]}
          </h1>
          <p>「{job?.input.topic ?? topic}」</p>
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
            <span>難易度：{job?.input.level ?? level}</span>
            <span>目的：{job?.input.purpose ?? purpose}</span>
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
              onClick={() => {
                setJobId("");
                nav("/create", {
                  replace: true,
                  state: job?.input ?? regeneration,
                });
              }}
            >
              条件を確認してもう一度試す
            </button>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="page create-page">
      <div className="create-intro">
        <div className="create-mark">
          <BookOpen />
          <Sparkles />
        </div>
        <span className="eyebrow">CREATE WITH AI</span>
        <h1>
          {regeneration?.sourceTextbookId
            ? "どんな学び方に変えますか？"
            : "次は、何を学びますか？"}
        </h1>
        <p>
          {regeneration?.sourceTextbookId
            ? "元の一冊を残したまま、難易度と目的を変えて新しい版を作ります。"
            : "ひとつのテーマから、あなただけの教科書を育てます。"}
        </p>
      </div>
      <section className="create-form">
        <label className="topic-label">
          <span>学びたいテーマ</span>
          <textarea
            maxLength={300}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            readOnly={Boolean(regeneration?.sourceTextbookId)}
            placeholder="例：産業革命は社会をどう変えた？"
          />
          <small>
            {regeneration?.sourceTextbookId
              ? "再生成では元の教科書と同じテーマを引き継ぎます。"
              : "テーマ、疑問、目標など、自由に書いてください。"}
          </small>
        </label>
        <fieldset>
          <legend>難易度</legend>
          <div className="choice-row">
            {(["初心者", "中級", "上級", "AIに任せる"] as const).map((x) => (
              <button
                type="button"
                onClick={() => setLevel(x)}
                className={level === x ? "selected" : ""}
                key={x}
              >
                {x}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>学ぶ目的</legend>
          <div className="choice-row">
            {(["趣味", "仕事", "資格", "教養"] as const).map((x) => (
              <button
                type="button"
                onClick={() => setPurpose(x)}
                className={purpose === x ? "selected" : ""}
                key={x}
              >
                {x}
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
          disabled={!firebaseConfigured || !user || topic.trim().length < 2}
          onClick={() => void generate()}
        >
          <Sparkles />
          {regeneration?.sourceTextbookId
            ? "この条件で再生成する"
            : "教科書を生成する"}
          <ChevronRight />
        </button>
        <p className="form-note">
          4章・全12ページを生成します。画面を閉じても処理は続きます。
        </p>
      </section>
    </div>
  );
}
