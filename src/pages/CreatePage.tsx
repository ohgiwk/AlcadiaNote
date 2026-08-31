import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import {
  GenerationForm,
  GenerationProgress,
  OutlineReview,
} from "../features/generation/GenerationViews";
import { firebaseConfigured } from "../firebase";
import { useDocument } from "../hooks/useFirestoreData";
import {
  approveTextbookOutline,
  createTextbook,
  restorePreviousTextbookOutline,
  reviseTextbookOutline,
  requestNextChapterGeneration,
} from "../services/firebaseService";
import type {
  GenerationJob,
  OutlineRevisionInput,
  TextbookGenerationInput,
} from "../types/models";

export function CreatePage() {
  const location = useLocation();
  const regeneration =
    location.state as Partial<TextbookGenerationInput> | null;
  const { user, error: authError } = useAuth();
  const [input, setInput] = useState<TextbookGenerationInput>({
    topic: regeneration?.topic ?? "産業革命と近代社会",
    level: regeneration?.level ?? "AIに任せる",
    purpose: regeneration?.purpose ?? "教養",
    sourceTextbookId: regeneration?.sourceTextbookId,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobId, setJobId] = useState(() => searchParams.get("job") ?? "");
  const [clock, setClock] = useState(0);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const navigate = useNavigate();
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
      () => navigate(`/textbooks/${job.textbookId}/read/${job.firstPageId}`),
      900,
    );
    return () => window.clearTimeout(timer);
  }, [job, navigate]);

  async function startGeneration() {
    setError("");
    try {
      const result = await createTextbook({
        ...input,
        topic: input.topic.trim(),
      });
      setJobId(result.jobId);
      setSearchParams({ job: result.jobId }, { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "生成を開始できませんでした",
      );
    }
  }

  async function approveOutline() {
    setError("");
    setApproving(true);
    try {
      const result = await approveTextbookOutline(jobId);
      setJobId(result.jobId);
      setSearchParams({ job: result.jobId }, { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "承認を受け付けられませんでした",
      );
    } finally {
      setApproving(false);
    }
  }

  async function retryChapter() {
    if (!job?.textbookId) return;
    setError("");
    try {
      const result = await requestNextChapterGeneration(job.textbookId);
      setJobId(result.jobId);
      setSearchParams({ job: result.jobId }, { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "章を再生成できませんでした",
      );
    }
  }

  async function reviseOutline(input: Omit<OutlineRevisionInput, "jobId">) {
    setError("");
    setRevising(true);
    try {
      const result = await reviseTextbookOutline({ jobId, ...input });
      setJobId(result.jobId);
      setSearchParams({ job: result.jobId }, { replace: true });
      setRevising(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "ロードマップを調整できませんでした",
      );
      setRevising(false);
    }
  }

  async function restoreOutline() {
    setError("");
    setRevising(true);
    try {
      await restorePreviousTextbookOutline(jobId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "ロードマップを復元できませんでした",
      );
    } finally {
      setRevising(false);
    }
  }

  if (!jobId) {
    return (
      <GenerationForm
        input={input}
        regeneration={regeneration}
        firebaseConfigured={firebaseConfigured}
        authenticated={Boolean(user)}
        authError={authError}
        error={error}
        onChange={setInput}
        onGenerate={() => void startGeneration()}
      />
    );
  }

  if (job?.status === "awaiting_approval" && job.outline) {
    return (
      <OutlineReview
        key={job.id}
        job={
          job as GenerationJob & {
            outline: NonNullable<GenerationJob["outline"]>;
          }
        }
        error={error}
        approving={approving}
        revising={revising}
        onApprove={() => void approveOutline()}
        onRevise={(revision) => void reviseOutline(revision)}
        onRestore={() => void restoreOutline()}
        onLater={() => navigate("/library")}
      />
    );
  }

  const startedAt = job?.startedAt || job?.createdAt;
  const startedAtTime = startedAt ? new Date(startedAt).getTime() : Number.NaN;
  const elapsed = Number.isFinite(startedAtTime)
    ? Math.max(0, Math.floor((clock - startedAtTime) / 1000))
    : Math.max(0, job?.elapsedSeconds ?? 0);

  return (
    <GenerationProgress
      job={job}
      loading={jobLoading}
      fallbackInput={input}
      elapsed={elapsed}
      onRetryChapter={() => void retryChapter()}
      onReset={() => {
        setJobId("");
        navigate("/create", {
          replace: true,
          state: job?.input ?? regeneration,
        });
      }}
    />
  );
}
