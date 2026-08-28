import { BookOpen, Check, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useDocument } from "../hooks/useFirestoreData";
import { firebaseConfigured } from "../firebase";
import { createTextbook } from "../services/firebaseService";
import type { GenerationJob, TextbookGenerationInput } from "../types/models";
const labels: Record<string, string> = {
  queued: "準備しています",
  researching: "信頼できる情報源を調査しています",
  outlining: "学習ロードマップを設計しています",
  writing: "章とページを書いています",
  finalizing: "問題とカードを仕上げています",
  completed: "完成しました",
  failed: "生成に失敗しました",
};
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
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const { data: job } = useDocument<GenerationJob>(
    jobId ? `generationJobs/${jobId}` : undefined,
  );
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成を開始できませんでした");
    }
  }
  if (jobId) {
    if (job?.status === "completed" && job.firstPageId)
      setTimeout(
        () => nav(`/textbooks/${job.textbookId}/read/${job.firstPageId}`),
        400,
      );
    return (
      <div className="generation">
        <div className="generation-orbit">
          <Sparkles />
          <i />
          <i />
        </div>
        <span className="eyebrow">BUILDING YOUR TEXTBOOK</span>
        <h1>
          {job?.status === "failed"
            ? "生成を完了できませんでした"
            : "あなたのために、知識を編んでいます。"}
        </h1>
        <p>「{topic}」を読みやすい一冊にしています</p>
        <div className="generation-steps">
          {["researching", "outlining", "writing", "finalizing"].map((x, i) => {
            const progress = job?.progress ?? 0;
            const done = progress >= [20, 40, 80, 100][i];
            return (
              <div
                className={
                  done
                    ? "done"
                    : progress >= [0, 20, 40, 80][i]
                      ? "current"
                      : ""
                }
                key={x}
              >
                {done ? <Check /> : <span>{i + 1}</span>}
                <strong>{labels[x]}</strong>
              </div>
            );
          })}
        </div>
        {job?.status === "failed" && (
          <button
            className="button primary"
            onClick={() => {
              setJobId("");
              void generate();
            }}
          >
            もう一度試す
          </button>
        )}
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
