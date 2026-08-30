/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { chapterContentSchema, textbookOutlineSchema } from "./schema.js";
import { containsGenerationMeta, withoutInlineLinks } from "./sanitize.js";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });
const db = getFirestore();
const openAiKey = defineSecret("OPENAI_API_KEY");
const openAiModel = defineString("OPENAI_MODEL", { default: "gpt-5-mini" });
const allowedLevels = ["初心者", "中級", "上級", "AIに任せる"];
const allowedPurposes = ["趣味", "仕事", "資格", "教養"];
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
        cover: "cobalt",
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

function outputText(response: any) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output ?? [])
    .flatMap((o: any) => o.content ?? [])
    .filter((c: any) => c.type === "output_text")
    .map((c: any) => c.text)
    .join("");
}
async function structuredGeneration(
  prompt: string,
  name: string,
  schema: object,
  useWebSearch = true,
) {
  const startedAt = Date.now();
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel.value(),
      ...(useWebSearch ? { tools: [{ type: "web_search" }] } : {}),
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`openai_${res.status}`);
  const json = await res.json();
  const text = outputText(json);
  if (!text) throw new Error("empty_model_output");
  return {
    data: JSON.parse(text),
    meta: {
      responseId: json.id ?? "",
      durationMs: Date.now() - startedAt,
      usage: json.usage ?? {},
      serviceTier: json.service_tier ?? "",
      webSearchCalls: (json.output ?? []).filter(
        (item: any) => item.type === "web_search_call",
      ).length,
    },
  };
}
async function generateOutline(input: any) {
  const generated = await structuredGeneration(
    `日本語の学習用教科書のロードマップと目次だけを作成してください。テーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n正確性を優先し、web_searchで信頼できる情報源を調査してください。全4章、各章3ページとし、章とページごとに具体的な要約を付け、各章に本文生成で再利用できる信頼性の高い参照元を3〜6件格納してください。タイトル・要約にはURL、Markdownリンク、ドメイン名や出典の括弧書きを含めないでください。本文、問題、暗記カードはまだ作成しないでください。`,
    "textbook_outline",
    textbookOutlineSchema,
  );
  const outline = generated.data;
  return {
    meta: generated.meta,
    title: withoutInlineLinks(outline.title),
    subtitle: containsGenerationMeta(outline.subtitle)
      ? `${input.topic}を体系的に学ぶ教科書`
      : withoutInlineLinks(outline.subtitle),
    category: withoutInlineLinks(outline.category),
    chapters: outline.chapters.map((chapter: any) => ({
      title: withoutInlineLinks(chapter.title),
      summary: withoutInlineLinks(chapter.summary),
      pages: chapter.pages.map((page: any) => ({
        title: withoutInlineLinks(page.title),
        summary: withoutInlineLinks(page.summary),
      })),
      sources: chapter.sources.map((source: any) => ({
        title: withoutInlineLinks(source.title),
        url: String(source.url),
      })),
    })),
  };
}
async function generateChapter(input: any, chapter: any, chapterOrder: number) {
  const hasResearch = Array.isArray(chapter.sources) && chapter.sources.length;
  return structuredGeneration(
    `あなたは高品質な教科書を執筆する専門家です。第${chapterOrder}章だけを生成してください。\nテーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n承認済み章構成: ${JSON.stringify(chapter)}\n各ページは構成の順番とタイトルを守り、800〜1,200文字を目安に、見出し2〜4個、定義、理由、具体例、背景、因果関係を含めて体系的に説明してください。冗長な水増し、不要な前置き、制作工程のメタ文言は禁止です。章の3ページを横断する選択式または正誤式の確認問題を5問、章の暗記カードを2枚作成してください。本文にURLや出典表記を含めず、参照情報はsourcesだけに格納してください。`,
    "chapter_content",
    chapterContentSchema,
    !hasResearch,
  );
}
async function generateTextbook(input: any, outline: any) {
  const chapters = [];
  const flashcards = [];
  for (const [index, chapter] of outline.chapters.entries()) {
    const generated = await generateChapter(input, chapter, index + 1);
    chapters.push(generated.data);
    flashcards.push(...generated.data.flashcards);
  }
  return { chapters, flashcards };
}
function block(raw: any) {
  const id = crypto.randomUUID();
  switch (raw.type) {
    case "heading":
      return {
        id,
        type: "heading",
        level: 2,
        text: withoutInlineLinks(raw.text || raw.title),
      };
    case "callout":
      return {
        id,
        type: "callout",
        tone: "key",
        title: withoutInlineLinks(raw.title),
        text: withoutInlineLinks(raw.text),
      };
    case "timeline":
      return {
        id,
        type: "checklist",
        items: raw.items.map(withoutInlineLinks).filter(Boolean),
      };
    case "table":
      return {
        id,
        type: "table",
        headers: raw.headers.map(withoutInlineLinks),
        rows: raw.rows.map((row: unknown[]) => row.map(withoutInlineLinks)),
      };
    case "checklist":
      return {
        id,
        type: "checklist",
        items: raw.items.map(withoutInlineLinks).filter(Boolean),
      };
    case "code":
      return { id, type: "code", language: "text", code: raw.text };
    case "question":
      return { id, type: "question", prompt: withoutInlineLinks(raw.text) };
    case "quote":
      return {
        id,
        type: "quote",
        text: withoutInlineLinks(raw.text),
        source: withoutInlineLinks(raw.title),
      };
    case "formula":
      return { id, type: "formula", formula: raw.text };
    case "ai":
      return {
        id,
        type: "ai",
        title: withoutInlineLinks(raw.title),
        text: withoutInlineLinks(raw.text),
      };
    default:
      return { id, type: "paragraph", text: withoutInlineLinks(raw.text) };
  }
}

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
      const generatedOutline = await generateOutline(job.input);
      const { meta, ...outline } = generatedOutline;
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
        "4章・12ページの構成を確認しています",
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
        tx.update(jobRef, {
          status: "failed",
          active: false,
          errorCode: "OUTLINE_GENERATION_FAILED",
          failedAtStage: currentStage,
          stageDetail: "ロードマップの生成中に問題が発生しました",
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (currentLock.data()?.jobId !== jobRef.id) return;
        tx.update(bookRef, {
          generationStatus: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.delete(generationLockRef);
      });
    }
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
      const outline = job.data()!.outline;
      const chapterIds = outline.chapters.map(
        (_chapter: any, index: number) => `chapter-${index + 1}`,
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
      if (order > 4)
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
        claimed.input,
        claimed.outlineChapter,
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
      const pageIds: string[] = [];
      for (const [index, page] of result.pages.entries()) {
        const pageRef = bookRef
          .collection("pages")
          .doc(`${claimed.chapterId}-page-${index + 1}`);
        pageIds.push(pageRef.id);
        batch.set(pageRef, {
          chapterId: claimed.chapterId,
          title: claimed.outlineChapter.pages[index].title,
          order: (claimed.chapterOrder - 1) * 3 + index + 1,
          readMinutes: page.readMinutes,
          blocks: page.blocks
            .filter(
              (raw: any) =>
                !containsGenerationMeta(`${raw.title ?? ""} ${raw.text ?? ""}`),
            )
            .map(block),
          sources: page.sources.map((source: any) => ({
            ...source,
            accessedAt: new Date().toISOString(),
          })),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const [index, quiz] of result.quizzes.entries()) {
        batch.set(
          bookRef
            .collection("quizzes")
            .doc(`${claimed.chapterId}-quiz-${index + 1}`),
          {
            ...quiz,
            chapterId: claimed.chapterId,
            order: index + 1,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
        );
      }
      for (const [index, card] of result.flashcards.entries()) {
        batch.set(
          bookRef
            .collection("flashcards")
            .doc(`${claimed.chapterId}-card-${index + 1}`),
          {
            textbookId: bookRef.id,
            chapterId: claimed.chapterId,
            ...card,
            mastery: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
        );
      }
      const count = claimed.chapterOrder;
      const completed = count === 4;
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

export const processTextbookContent = onDocumentUpdated(
  {
    document: "generationJobs/{jobId}",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [openAiKey],
    retry: false,
  },
  async (event) => {
    if (
      event.data?.before.data()?.status !== "awaiting_approval" ||
      event.data?.after.data()?.status !== "approved"
    )
      return;
    const jobRef = event.data.after.ref;
    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(jobRef);
      if (current.data()?.status !== "approved") return undefined;
      tx.update(jobRef, {
        status: "writing",
        progress: 44,
        stageDetail: "承認済みの構成に沿って本文を生成しています",
        contentStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return current.data();
    });
    if (!claimed) return;
    const bookRef = db.doc(`textbooks/${claimed.textbookId}`);
    let currentStage = "writing";
    try {
      await bookRef.update({
        generationStatus: "writing",
        updatedAt: FieldValue.serverTimestamp(),
      });
      const result = await generateTextbook(claimed.input, claimed.outline);
      const chapterIds: string[] = [];
      let firstPageId: string | undefined;
      const batch = db.batch();
      for (const [ci, c] of result.chapters.entries()) {
        const approvedChapter = claimed.outline.chapters[ci];
        currentStage = "writing";
        await updateGenerationStage(
          jobRef,
          bookRef,
          "writing",
          52 + ci * 8,
          `第${ci + 1}章のページと確認問題を保存しています`,
        );
        const chapterRef = bookRef.collection("chapters").doc();
        chapterIds.push(chapterRef.id);
        const pageIds: string[] = [];
        for (const [pi, p] of c.pages.entries()) {
          const pageRef = bookRef.collection("pages").doc();
          if (!firstPageId) firstPageId = pageRef.id;
          pageIds.push(pageRef.id);
          batch.set(pageRef, {
            chapterId: chapterRef.id,
            title: approvedChapter.pages[pi].title,
            order: ci * 3 + pi + 1,
            readMinutes: p.readMinutes,
            blocks: p.blocks
              .filter(
                (raw: any) =>
                  !containsGenerationMeta(
                    `${raw.title ?? ""} ${raw.text ?? ""}`,
                  ),
              )
              .map(block),
            sources: p.sources.map((s: any) => ({
              ...s,
              accessedAt: new Date().toISOString(),
            })),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        for (const [quizIndex, quiz] of c.quizzes.entries()) {
          const quizRef = bookRef.collection("quizzes").doc();
          batch.set(quizRef, {
            ...quiz,
            chapterId: chapterRef.id,
            order: quizIndex + 1,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        batch.set(chapterRef, {
          textbookId: bookRef.id,
          title: approvedChapter.title,
          order: ci + 1,
          pageIds,
          progress: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      currentStage = "finalizing";
      await updateGenerationStage(
        jobRef,
        bookRef,
        "finalizing",
        90,
        "暗記カードと参照元を仕上げています",
      );
      for (const card of result.flashcards) {
        const ref = bookRef.collection("flashcards").doc();
        batch.set(ref, {
          textbookId: bookRef.id,
          ...card,
          mastery: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await jobRef.update({
        progress: 96,
        stageDetail: "すべてのデータを確認して公開準備をしています",
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(bookRef, {
        title: claimed.outline.title,
        subtitle: claimed.outline.subtitle,
        category: claimed.outline.category,
        chapterIds,
        firstPageId,
        generationStatus: "completed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(jobRef, {
        status: "completed",
        progress: 100,
        stageDetail: "教科書が完成しました",
        active: false,
        firstPageId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      console.error("generation_failed", error);
      await Promise.all([
        jobRef.update({
          status: "failed",
          active: false,
          errorCode: "GENERATION_FAILED",
          failedAtStage: currentStage,
          stageDetail: "生成中に問題が発生しました",
          updatedAt: FieldValue.serverTimestamp(),
        }),
        bookRef.update({
          generationStatus: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        }),
      ]);
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
