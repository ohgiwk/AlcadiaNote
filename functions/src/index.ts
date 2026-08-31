import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { queueChapterContentWrites } from "./chapter-writes.js";
import { generateChapter, generateOutline } from "./generation.js";
import { outputText } from "./openai.js";
import type {
  OutlineChapter,
  OutlineRevision,
  TextbookGenerationInput,
  TextbookOutline,
} from "./types.js";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });
const db = getFirestore();
const openAiKey = defineSecret("OPENAI_API_KEY");
const openAiModel = defineString("OPENAI_MODEL", { default: "gpt-5-mini" });
const allowedLevels = ["初心者", "中級", "上級", "AIに任せる"];
const allowedPurposes = ["趣味", "仕事", "資格", "教養"];
const coverStyles = [
  "cobalt",
  "terracotta",
  "sage",
  "violet",
  "amber",
  "rose",
  "teal",
  "slate",
];

function generationConfig() {
  return { apiKey: openAiKey.value(), model: openAiModel.value() };
}

function randomCoverStyle() {
  return coverStyles[Math.floor(Math.random() * coverStyles.length)];
}

export const createTextbook = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    let topic = String(request.data?.topic ?? "").trim();
    const level = String(request.data?.level ?? "");
    const purpose = String(request.data?.purpose ?? "");
    const sourceTextbookId = String(request.data?.sourceTextbookId ?? "");
    if (
      topic.length < 2 ||
      topic.length > 300 ||
      !allowedLevels.includes(level) ||
      !allowedPurposes.includes(purpose)
    )
      throw new HttpsError("invalid-argument", "入力内容を確認してください");
    if (sourceTextbookId && !/^[A-Za-z0-9_-]{1,128}$/.test(sourceTextbookId))
      throw new HttpsError("invalid-argument", "再生成元のIDが不正です");
    if (sourceTextbookId) {
      const source = await db.doc(`textbooks/${sourceTextbookId}`).get();
      if (!source.exists || source.data()?.ownerId !== request.auth.uid)
        throw new HttpsError(
          "permission-denied",
          "この教科書は再生成できません",
        );
      if (source.data()?.generationStatus !== "completed")
        throw new HttpsError(
          "failed-precondition",
          "完成済みの教科書だけ再生成できます",
        );
      topic = String(
        source.data()?.topic || source.data()?.title || topic,
      ).trim();
    }
    const book = db.collection("textbooks").doc();
    const job = db.collection("generationJobs").doc();
    const generationLockRef = db.doc(`generationLocks/${request.auth.uid}`);
    const cover = randomCoverStyle();
    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (tx) => {
      const generationLock = await tx.get(generationLockRef);
      const lockCreatedAt = generationLock.data()?.createdAt?.toMillis?.() ?? 0;
      if (generationLock.exists && Date.now() - lockCreatedAt < 15 * 60_000)
        throw new HttpsError("resource-exhausted", "生成中の教科書があります");
      tx.set(book, {
        ownerId: request.auth!.uid,
        topic,
        level,
        purpose,
        ...(sourceTextbookId ? { sourceTextbookId } : {}),
        title: topic,
        subtitle: "生成中…",
        category: "AI教科書",
        cover,
        progress: 0,
        favorite: false,
        chapterIds: [],
        generationStatus: "queued",
        generationJobId: job.id,
        firstPageId: null,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(job, {
        jobType: "outline",
        ownerId: request.auth!.uid,
        textbookId: book.id,
        input: {
          topic,
          level,
          purpose,
          ...(sourceTextbookId ? { sourceTextbookId } : {}),
        },
        status: "queued",
        progress: 0,
        stageDetail: "生成ジョブを受け付けました",
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(generationLockRef, {
        jobId: job.id,
        textbookId: book.id,
        jobType: "outline",
        createdAt: now,
      });
    });
    return { jobId: job.id, textbookId: book.id };
  },
);

async function updateGenerationStage(
  jobRef: FirebaseFirestore.DocumentReference,
  bookRef: FirebaseFirestore.DocumentReference,
  status: string,
  progress: number,
  stageDetail: string,
) {
  await Promise.all([
    jobRef.update({
      status,
      progress,
      stageDetail,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    bookRef.update({
      generationStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  ]);
}

export const processTextbookOutline = onDocumentCreated(
  {
    document: "generationJobs/{jobId}",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [openAiKey],
    retry: false,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    if (job.jobType === "chapter") return;
    const jobRef = snap.ref;
    const bookRef = db.doc(`textbooks/${job.textbookId}`);
    const generationLockRef = db.doc(`generationLocks/${job.ownerId}`);
    let researchHeartbeat: NodeJS.Timeout | undefined;
    let heartbeatWrite: Promise<unknown> = Promise.resolve();
    let currentStage = "queued";
    try {
      const claimed = await db.runTransaction(async (tx) => {
        const current = await tx.get(jobRef);
        if (current.data()?.status !== "queued") return false;
        tx.update(jobRef, {
          status: "researching",
          progress: 8,
          stageDetail: "AIがWebを調査し、教科書の構成を考えています",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(bookRef, {
          generationStatus: "researching",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!claimed) return;
      currentStage = "researching";
      const researchStartedAt = Date.now();
      researchHeartbeat = setInterval(() => {
        const elapsedSeconds = Math.floor(
          (Date.now() - researchStartedAt) / 1000,
        );
        const progress = Math.min(28, 8 + Math.floor(elapsedSeconds / 15) * 3);
        heartbeatWrite = heartbeatWrite
          .then(() =>
            jobRef.update({
              progress,
              elapsedSeconds,
              stageDetail: "AIが情報源を調査し、ロードマップを設計しています",
              updatedAt: FieldValue.serverTimestamp(),
            }),
          )
          .catch((error) => console.warn("generation_heartbeat_failed", error));
      }, 15000);
      const generatedOutline = await generateOutline(
        generationConfig(),
        job.input as TextbookGenerationInput,
        job.revision
          ? {
              ...(job.revision as OutlineRevision),
              currentOutline: job.previousOutline as TextbookOutline,
            }
          : undefined,
      );
      const { data: outline, meta } = generatedOutline;
      clearInterval(researchHeartbeat);
      researchHeartbeat = undefined;
      await heartbeatWrite;
      const currentLock = await generationLockRef.get();
      if (currentLock.data()?.jobId !== jobRef.id) {
        await jobRef.update({
          status: "failed",
          active: false,
          errorCode: "SUPERSEDED_OUTLINE_JOB",
          stageDetail: "新しい生成ジョブへ引き継ぎました",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
      currentStage = "outlining";
      await updateGenerationStage(
        jobRef,
        bookRef,
        "outlining",
        30,
        "ロードマップの構成を確認しています",
      );
      const batch = db.batch();
      batch.update(jobRef, {
        status: "awaiting_approval",
        progress: 35,
        stageDetail: "ロードマップと目次を確認してください",
        outline,
        openAi: meta,
        outlineReadyAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(bookRef, {
        title: outline.title,
        subtitle: outline.subtitle,
        category: outline.category,
        generationStatus: "awaiting_approval",
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(generationLockRef);
      await batch.commit();
      return;
    } catch (error) {
      if (researchHeartbeat) clearInterval(researchHeartbeat);
      await heartbeatWrite;
      console.error("outline_generation_failed", error);
      await db.runTransaction(async (tx) => {
        const currentLock = await tx.get(generationLockRef);
        const fallbackOutline = job.previousOutline as
          TextbookOutline | undefined;
        const fallbackInput = job.previousInput as
          TextbookGenerationInput | undefined;
        tx.update(
          jobRef,
          fallbackOutline
            ? {
                status: "awaiting_approval",
                active: false,
                outline: fallbackOutline,
                ...(fallbackInput ? { input: fallbackInput } : {}),
                errorCode: "OUTLINE_REVISION_FAILED",
                failedAtStage: currentStage,
                stageDetail:
                  "調整に失敗したため、直前のロードマップを表示しています",
                updatedAt: FieldValue.serverTimestamp(),
              }
            : {
                status: "failed",
                active: false,
                errorCode: "OUTLINE_GENERATION_FAILED",
                failedAtStage: currentStage,
                stageDetail: "ロードマップの生成中に問題が発生しました",
                updatedAt: FieldValue.serverTimestamp(),
              },
        );
        if (currentLock.data()?.jobId !== jobRef.id) return;
        tx.update(bookRef, {
          generationStatus: fallbackOutline ? "awaiting_approval" : "failed",
          ...(fallbackOutline
            ? {
                title: fallbackOutline.title,
                subtitle: fallbackOutline.subtitle,
                category: fallbackOutline.category,
                ...(fallbackInput
                  ? {
                      level: fallbackInput.level,
                      purpose: fallbackInput.purpose,
                    }
                  : {}),
              }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.delete(generationLockRef);
      });
    }
  },
);

export const reviseTextbookOutline = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    const jobId = String(request.data?.jobId ?? "");
    const instruction = String(request.data?.instruction ?? "").trim();
    const scope = String(request.data?.scope ?? "");
    const quickAction = request.data?.quickAction
      ? String(request.data.quickAction)
      : undefined;
    const chapterIndex =
      request.data?.chapterIndex === undefined
        ? undefined
        : Number(request.data.chapterIndex);
    const chapterCount =
      request.data?.chapterCount === undefined
        ? undefined
        : Number(request.data.chapterCount);
    const pageCounts: number[] | undefined = Array.isArray(
      request.data?.pageCounts,
    )
      ? request.data.pageCounts.map(Number)
      : undefined;
    const level = request.data?.level ? String(request.data.level) : undefined;
    const purpose = request.data?.purpose
      ? String(request.data.purpose)
      : undefined;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId))
      throw new HttpsError("invalid-argument", "生成ジョブIDが不正です");
    if (instruction.length > 1000 || !["all", "chapter"].includes(scope))
      throw new HttpsError("invalid-argument", "調整内容を確認してください");
    if (
      (chapterCount === undefined) !== (pageCounts === undefined) ||
      (chapterCount !== undefined &&
        (!Number.isInteger(chapterCount) ||
          chapterCount < 2 ||
          chapterCount > 8 ||
          pageCounts!.length !== chapterCount ||
          pageCounts!.some(
            (count) => !Number.isInteger(count) || count < 1 || count > 8,
          )))
    )
      throw new HttpsError(
        "invalid-argument",
        "章数またはページ数が範囲外です",
      );
    if (
      quickAction &&
      !["detailed", "simple", "practical"].includes(quickAction)
    )
      throw new HttpsError("invalid-argument", "調整方法が不正です");
    if (
      (level && !allowedLevels.includes(level)) ||
      (purpose && !allowedPurposes.includes(purpose))
    )
      throw new HttpsError("invalid-argument", "生成条件が不正です");

    const sourceJobRef = db.doc(`generationJobs/${jobId}`);
    const nextJobRef = db.collection("generationJobs").doc();
    const lockRef = db.doc(`generationLocks/${request.auth.uid}`);
    await db.runTransaction(async (tx) => {
      const [sourceJob, lock] = await Promise.all([
        tx.get(sourceJobRef),
        tx.get(lockRef),
      ]);
      const data = sourceJob.data();
      if (!sourceJob.exists || data?.ownerId !== request.auth!.uid)
        throw new HttpsError("permission-denied", "調整する権限がありません");
      if (data?.status !== "awaiting_approval" || !data.outline)
        throw new HttpsError(
          "failed-precondition",
          "このロードマップは調整できません",
        );
      const currentOutline = data.outline as TextbookOutline;
      const nextLevel = level ?? data.input.level;
      const nextPurpose = purpose ?? data.input.purpose;
      if (
        scope === "chapter" &&
        (!Number.isInteger(chapterIndex) ||
          chapterIndex! < 0 ||
          chapterIndex! >= currentOutline.chapters.length ||
          (chapterCount !== undefined &&
            chapterCount !== currentOutline.chapters.length))
      )
        throw new HttpsError("invalid-argument", "対象の章が不正です");
      if (
        scope === "chapter" &&
        (nextLevel !== data.input.level || nextPurpose !== data.input.purpose)
      )
        throw new HttpsError(
          "invalid-argument",
          "難易度と目的は全体調整で変更してください",
        );
      const currentPageCounts = currentOutline.chapters.map(
        (chapter) => chapter.pages.length,
      );
      if (
        scope === "chapter" &&
        pageCounts?.some(
          (count, index) =>
            index !== chapterIndex && count !== currentPageCounts[index],
        )
      )
        throw new HttpsError(
          "invalid-argument",
          "対象外の章のページ数は変更できません",
        );
      const hasDimensionChange =
        (chapterCount !== undefined &&
          chapterCount !== currentOutline.chapters.length) ||
        Boolean(
          pageCounts?.some(
            (count, index) => count !== currentPageCounts[index],
          ),
        );
      const hasConditionChange =
        nextLevel !== data.input.level || nextPurpose !== data.input.purpose;
      if (
        !instruction &&
        !quickAction &&
        !hasDimensionChange &&
        !hasConditionChange
      )
        throw new HttpsError("invalid-argument", "調整内容を入力してください");
      const lockCreatedAt = lock.data()?.createdAt?.toMillis?.() ?? 0;
      if (lock.exists && Date.now() - lockCreatedAt < 15 * 60_000)
        throw new HttpsError("resource-exhausted", "別の生成処理が進行中です");
      const bookRef = db.doc(`textbooks/${data.textbookId}`);
      const now = FieldValue.serverTimestamp();
      const revision: OutlineRevision = {
        instruction,
        scope: scope as OutlineRevision["scope"],
        ...(chapterIndex === undefined ? {} : { chapterIndex }),
        ...(quickAction
          ? { quickAction: quickAction as OutlineRevision["quickAction"] }
          : {}),
        ...(chapterCount === undefined ? {} : { chapterCount }),
        ...(pageCounts === undefined ? {} : { pageCounts }),
        ...(level ? { level: level as OutlineRevision["level"] } : {}),
        ...(purpose ? { purpose: purpose as OutlineRevision["purpose"] } : {}),
      };
      const nextInput = {
        ...data.input,
        level: nextLevel,
        purpose: nextPurpose,
      };
      tx.update(sourceJobRef, {
        status: "superseded",
        active: false,
        stageDetail: "調整後のロードマップへ引き継ぎました",
        updatedAt: now,
      });
      tx.set(nextJobRef, {
        jobType: "outline",
        ownerId: request.auth!.uid,
        textbookId: data.textbookId,
        input: nextInput,
        revision,
        previousOutline: currentOutline,
        previousInput: data.input,
        previousJobId: sourceJobRef.id,
        status: "queued",
        progress: 0,
        active: true,
        stageDetail: "ロードマップの調整を受け付けました",
        createdAt: now,
        updatedAt: now,
      });
      tx.update(bookRef, {
        generationStatus: "queued",
        generationJobId: nextJobRef.id,
        level: nextLevel,
        purpose: nextPurpose,
        updatedAt: now,
      });
      tx.set(lockRef, {
        jobId: nextJobRef.id,
        textbookId: data.textbookId,
        jobType: "outline",
        createdAt: now,
      });
    });
    return { jobId: nextJobRef.id };
  },
);

export const restorePreviousTextbookOutline = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    const jobId = String(request.data?.jobId ?? "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId))
      throw new HttpsError("invalid-argument", "生成ジョブIDが不正です");
    const jobRef = db.doc(`generationJobs/${jobId}`);
    await db.runTransaction(async (tx) => {
      const job = await tx.get(jobRef);
      const data = job.data();
      if (!job.exists || data?.ownerId !== request.auth!.uid)
        throw new HttpsError("permission-denied", "復元する権限がありません");
      if (data?.status !== "awaiting_approval" || !data.previousOutline)
        throw new HttpsError(
          "failed-precondition",
          "復元できるロードマップがありません",
        );
      const outline = data.previousOutline as TextbookOutline;
      const previousInput = data.previousInput as
        TextbookGenerationInput | undefined;
      const bookRef = db.doc(`textbooks/${data.textbookId}`);
      tx.update(jobRef, {
        outline,
        previousOutline: FieldValue.delete(),
        previousInput: FieldValue.delete(),
        previousJobId: FieldValue.delete(),
        ...(previousInput ? { input: previousInput } : {}),
        errorCode: FieldValue.delete(),
        stageDetail: "直前のロードマップへ戻しました",
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(bookRef, {
        title: outline.title,
        subtitle: outline.subtitle,
        category: outline.category,
        ...(previousInput
          ? { level: previousInput.level, purpose: previousInput.purpose }
          : {}),
        generationStatus: "awaiting_approval",
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { restored: true, jobId };
  },
);

export const approveTextbookOutline = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    const jobId = String(request.data?.jobId ?? "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId))
      throw new HttpsError("invalid-argument", "生成ジョブIDが不正です");
    const jobRef = db.doc(`generationJobs/${jobId}`);
    const chapterJobRef = db.collection("generationJobs").doc();
    const generationLockRef = db.doc(`generationLocks/${request.auth.uid}`);
    await db.runTransaction(async (tx) => {
      const [job, generationLock] = await Promise.all([
        tx.get(jobRef),
        tx.get(generationLockRef),
      ]);
      if (!job.exists || job.data()?.ownerId !== request.auth!.uid)
        throw new HttpsError("permission-denied", "承認する権限がありません");
      if (job.data()?.status !== "awaiting_approval")
        throw new HttpsError(
          "failed-precondition",
          "このロードマップは承認できません",
        );
      if (!job.data()?.outline)
        throw new HttpsError("failed-precondition", "ロードマップがありません");
      const lockCreatedAt = generationLock.data()?.createdAt?.toMillis?.() ?? 0;
      if (generationLock.exists && Date.now() - lockCreatedAt < 15 * 60_000)
        throw new HttpsError("resource-exhausted", "生成中の章があります");
      const bookRef = db.doc(`textbooks/${job.data()!.textbookId}`);
      const outline = job.data()!.outline as TextbookOutline;
      const chapterIds = outline.chapters.map(
        (_chapter, index) => `chapter-${index + 1}`,
      );
      for (const [index, chapter] of outline.chapters.entries()) {
        tx.set(bookRef.collection("chapters").doc(chapterIds[index]), {
          textbookId: bookRef.id,
          title: chapter.title,
          order: index + 1,
          pageIds: [],
          progress: 0,
          generationStatus: index === 0 ? "queued" : "pending",
          generationProgress: 0,
          elapsedSeconds: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.update(jobRef, {
        status: "completed",
        progress: 100,
        active: false,
        stageDetail: "構成を承認し、第1章の生成を開始しました",
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(bookRef, {
        outline,
        chapterIds,
        generatedChapterCount: 0,
        nextChapterOrder: 1,
        activeChapterId: chapterIds[0],
        generationStatus: "writing",
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(chapterJobRef, {
        jobType: "chapter",
        ownerId: request.auth!.uid,
        textbookId: bookRef.id,
        chapterId: chapterIds[0],
        chapterOrder: 1,
        attempt: 1,
        input: job.data()!.input,
        outlineChapter: outline.chapters[0],
        status: "queued",
        progress: 0,
        stageDetail: "第1章の生成を受け付けました",
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(generationLockRef, {
        jobId: chapterJobRef.id,
        textbookId: bookRef.id,
        chapterId: chapterIds[0],
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { approved: true, jobId: chapterJobRef.id };
  },
);

export const requestNextChapterGeneration = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    const textbookId = String(request.data?.textbookId ?? "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(textbookId))
      throw new HttpsError("invalid-argument", "教科書IDが不正です");
    const bookRef = db.doc(`textbooks/${textbookId}`);
    const chapterJobRef = db.collection("generationJobs").doc();
    const generationLockRef = db.doc(`generationLocks/${request.auth.uid}`);
    await db.runTransaction(async (tx) => {
      const [book, generationLock] = await Promise.all([
        tx.get(bookRef),
        tx.get(generationLockRef),
      ]);
      if (!book.exists || book.data()?.ownerId !== request.auth!.uid)
        throw new HttpsError("permission-denied", "生成する権限がありません");
      const lockCreatedAt = generationLock.data()?.createdAt?.toMillis?.() ?? 0;
      const hasActiveLock =
        generationLock.exists && Date.now() - lockCreatedAt < 15 * 60_000;
      if (hasActiveLock)
        throw new HttpsError("resource-exhausted", "生成中の章があります");
      const order = Number(book.data()?.nextChapterOrder ?? 1);
      const totalChapters = Number(book.data()?.outline?.chapters?.length ?? 0);
      if (order > totalChapters)
        throw new HttpsError(
          "failed-precondition",
          "すべての章が完成しています",
        );
      const chapterId = `chapter-${order}`;
      const chapterRef = bookRef.collection("chapters").doc(chapterId);
      const chapter = await tx.get(chapterRef);
      if (!chapter.exists)
        throw new HttpsError("failed-precondition", "章の構成がありません");
      if (
        !["pending", "failed", "queued", "generating"].includes(
          chapter.data()?.generationStatus,
        ) ||
        (["queued", "generating"].includes(chapter.data()?.generationStatus) &&
          !generationLock.exists)
      )
        throw new HttpsError("failed-precondition", "この章は生成できません");
      const outlineChapter = book.data()?.outline?.chapters?.[order - 1];
      if (!outlineChapter)
        throw new HttpsError("failed-precondition", "章の構成がありません");
      tx.update(chapterRef, {
        generationStatus: "queued",
        generationProgress: 0,
        elapsedSeconds: 0,
        errorCode: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(bookRef, {
        activeChapterId: chapterId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(chapterJobRef, {
        jobType: "chapter",
        ownerId: request.auth!.uid,
        textbookId,
        chapterId,
        chapterOrder: order,
        attempt: Number(chapter.data()?.attempt ?? 0) + 1,
        input: {
          topic: book.data()?.topic,
          level: book.data()?.level,
          purpose: book.data()?.purpose,
        },
        outlineChapter,
        status: "queued",
        progress: 0,
        stageDetail: `第${order}章の生成を受け付けました`,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(generationLockRef, {
        jobId: chapterJobRef.id,
        textbookId,
        chapterId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { jobId: chapterJobRef.id };
  },
);

export const processTextbookChapter = onDocumentCreated(
  {
    document: "generationJobs/{jobId}",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [openAiKey],
    retry: false,
  },
  async (event) => {
    const snap = event.data;
    if (!snap || snap.data().jobType !== "chapter") return;
    const jobRef = snap.ref;
    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(jobRef);
      if (current.data()?.status !== "queued") return undefined;
      tx.update(jobRef, {
        status: "writing",
        progress: 12,
        stageDetail: `第${current.data()?.chapterOrder}章の本文を生成しています`,
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return current.data();
    });
    if (!claimed) return;
    const bookRef = db.doc(`textbooks/${claimed.textbookId}`);
    const chapterRef = bookRef.collection("chapters").doc(claimed.chapterId);
    const generationLockRef = db.doc(`generationLocks/${claimed.ownerId}`);
    const startedAt = Date.now();
    let liveProgress = 12;
    const progressTimer = setInterval(() => {
      liveProgress = Math.min(78, liveProgress + 3);
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      void Promise.all([
        jobRef.update({
          progress: liveProgress,
          elapsedSeconds,
          stageDetail: `第${claimed.chapterOrder}章の本文を生成しています（${elapsedSeconds}秒経過）`,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        chapterRef.update({
          generationProgress: liveProgress,
          elapsedSeconds,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      ]).catch((error) =>
        console.warn("chapter_progress_update_failed", error),
      );
    }, 10_000);
    try {
      await chapterRef.update({
        generationStatus: "generating",
        generationProgress: 12,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const generated = await generateChapter(
        generationConfig(),
        claimed.input as TextbookGenerationInput,
        claimed.outlineChapter as OutlineChapter,
        claimed.chapterOrder,
      );
      clearInterval(progressTimer);
      const currentLock = await generationLockRef.get();
      if (currentLock.data()?.jobId !== jobRef.id) {
        await jobRef.update({
          status: "failed",
          active: false,
          errorCode: "SUPERSEDED_CHAPTER_JOB",
          stageDetail: "新しい再試行ジョブへ引き継ぎました",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }
      await Promise.all([
        jobRef.update({
          progress: 85,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          stageDetail: `第${claimed.chapterOrder}章を保存しています`,
          updatedAt: FieldValue.serverTimestamp(),
        }),
        chapterRef.update({
          generationProgress: 85,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      ]);
      const result = generated.data;
      const batch = db.batch();
      const pageIds = queueChapterContentWrites({
        batch,
        bookRef,
        chapterId: claimed.chapterId,
        chapterOrder: claimed.chapterOrder,
        approvedChapter: claimed.outlineChapter as OutlineChapter,
        result,
      });
      const count = claimed.chapterOrder;
      const book = await bookRef.get();
      const completed =
        count === Number(book.data()?.outline?.chapters?.length ?? 0);
      batch.update(chapterRef, {
        pageIds,
        generationStatus: "completed",
        generationProgress: 100,
        attempt: claimed.attempt,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(bookRef, {
        generatedChapterCount: count,
        nextChapterOrder: count + 1,
        activeChapterId: null,
        generationStatus: completed ? "completed" : "ready",
        ...(count === 1 ? { firstPageId: pageIds[0] } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(jobRef, {
        status: "completed",
        progress: 100,
        active: false,
        firstPageId: pageIds[0],
        stageDetail: `第${count}章が完成しました`,
        openAi: generated.meta,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.delete(generationLockRef);
      await batch.commit();
    } catch (error) {
      clearInterval(progressTimer);
      console.error("chapter_generation_failed", error);
      await db.runTransaction(async (tx) => {
        const currentLock = await tx.get(generationLockRef);
        tx.update(jobRef, {
          status: "failed",
          active: false,
          errorCode: "CHAPTER_GENERATION_FAILED",
          stageDetail: `第${claimed.chapterOrder}章の生成に失敗しました`,
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (currentLock.data()?.jobId !== jobRef.id) return;
        tx.update(chapterRef, {
          generationStatus: "failed",
          errorCode: "CHAPTER_GENERATION_FAILED",
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(bookRef, {
          activeChapterId: null,
          generationStatus: claimed.chapterOrder === 1 ? "failed" : "ready",
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.delete(generationLockRef);
      });
    }
  },
);

export const deleteTextbook = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    const textbookId = String(request.data?.textbookId ?? "");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(textbookId))
      throw new HttpsError("invalid-argument", "教科書IDが不正です");

    const bookRef = db.doc(`textbooks/${textbookId}`);
    const book = await bookRef.get();
    if (!book.exists) return { deleted: true };
    if (book.data()?.ownerId !== request.auth.uid)
      throw new HttpsError("permission-denied", "削除する権限がありません");
    if (
      book.data()?.activeChapterId ||
      [
        "queued",
        "researching",
        "outlining",
        "approved",
        "writing",
        "finalizing",
      ].includes(book.data()?.generationStatus)
    )
      throw new HttpsError(
        "failed-precondition",
        "生成中の教科書は削除できません",
      );

    const uid = request.auth.uid;
    const userCollections = [
      "bookmarks",
      "notes",
      "highlights",
      "quizAttempts",
      "flashcardProgress",
      "conversations",
    ];
    const [jobs, ...userSnapshots] = await Promise.all([
      db
        .collection("generationJobs")
        .where("textbookId", "==", textbookId)
        .get(),
      ...userCollections.map((name) =>
        db
          .collection(`users/${uid}/${name}`)
          .where("textbookId", "==", textbookId)
          .get(),
      ),
    ]);
    const progressRef = db.doc(`users/${uid}/progress/${textbookId}`);
    const writer = db.bulkWriter();
    for (const job of jobs.docs)
      if (job.data().ownerId === uid) writer.delete(job.ref);
    for (const snapshot of userSnapshots)
      for (const item of snapshot.docs) writer.delete(item.ref);
    writer.delete(progressRef);
    await writer.close();
    await db.recursiveDelete(bookRef);
    return { deleted: true };
  },
);

export const askPageQuestion = onCall(
  { enforceAppCheck: false, secrets: [openAiKey] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "ログインが必要です");
    const { textbookId, pageId } = request.data ?? {};
    const prompt = String(request.data?.prompt ?? "").trim();
    if (!textbookId || !pageId || !prompt || prompt.length > 1000)
      throw new HttpsError("invalid-argument", "質問を確認してください");
    const book = await db.doc(`textbooks/${textbookId}`).get();
    if (!book.exists || book.data()?.ownerId !== request.auth.uid)
      throw new HttpsError("permission-denied", "アクセスできません");
    const page = await book.ref.collection("pages").doc(pageId).get();
    if (!page.exists) throw new HttpsError("not-found", "ページがありません");
    const context = JSON.stringify({
      title: page.data()?.title,
      blocks: page.data()?.blocks,
      sources: page.data()?.sources,
    });
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel.value(),
        input: `次の教科書ページだけを根拠に日本語で回答してください。\n${context}\n質問: ${prompt}`,
      }),
    });
    if (!res.ok) throw new HttpsError("internal", "AI回答を生成できません");
    const answer = outputText(await res.json());
    const ref = db.doc(
      `users/${request.auth.uid}/conversations/${textbookId}_${pageId}`,
    );
    await ref.set(
      {
        ownerId: request.auth.uid,
        textbookId,
        pageId,
        messages: FieldValue.arrayUnion(
          { id: crypto.randomUUID(), role: "user", text: prompt },
          { id: crypto.randomUUID(), role: "assistant", text: answer },
        ),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { answer };
  },
);
