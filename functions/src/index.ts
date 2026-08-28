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
import { textbookOutlineSchema, textbookSchema } from "./schema.js";
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
    const active = await db
      .collection("generationJobs")
      .where("ownerId", "==", request.auth.uid)
      .where("active", "==", true)
      .limit(1)
      .get();
    if (!active.empty)
      throw new HttpsError("resource-exhausted", "生成中の教科書があります");
    const book = db.collection("textbooks").doc();
    const job = db.collection("generationJobs").doc();
    const now = FieldValue.serverTimestamp();
    await db.runTransaction(async (tx) => {
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
) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel.value(),
      tools: [{ type: "web_search" }],
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
  return JSON.parse(text);
}
async function generateOutline(input: any) {
  const outline = await structuredGeneration(
    `日本語の学習用教科書のロードマップと目次だけを作成してください。テーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n正確性を優先し、web_searchで信頼できる情報源を調査してください。全4章、各章3ページとし、章とページごとに、これから本文で扱う内容が判断できる具体的な要約を付けてください。タイトル・要約にはURL、Markdownリンク、ドメイン名や出典の括弧書きを含めないでください。本文、問題、暗記カードはまだ作成しないでください。`,
    "textbook_outline",
    textbookOutlineSchema,
  );
  return {
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
    })),
  };
}
async function generateTextbook(input: any, outline: any) {
  return structuredGeneration(
    `あなたは高品質な教科書を執筆する専門家です。承認済みのロードマップに厳密に従って、日本語の学習用教科書本文を作成してください。\nテーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n承認済みロードマップ: ${JSON.stringify(outline)}\n\n【各ページの執筆基準】\n- 単なる概要説明ではなく、そのページだけでもテーマを十分理解できる密度で執筆する\n- 本文は800〜1,200文字を目安とし、重要なテーマでは最大1,500文字程度まで許容する\n- 文字数を満たすための冗長な説明は禁止する\n- 必要に応じて見出しを2〜4個使用する\n- 定義だけで終わらず「なぜそうなるのか」まで説明する\n- 抽象的な概念には具体例を入れる\n- 前提知識が必要なら簡潔に補足する\n- 重要語句は明確に定義する\n- 必要に応じて比較、因果関係、背景を説明する\n- 図が理解を助ける場合は、calloutブロックで挿入位置と図表の内容を具体的に指定する\n\n【文章レベル】\n一般的な学校教科書〜入門専門書程度とし、簡潔さよりも体系的に理解できることを優先する。\n\n【禁止】\n- 箇条書きだけでページを構成する\n- 数行の説明だけで次のテーマへ進む\n- 「〜について説明します」のような不要な前置き\n- 同じ内容の言い換えによる水増し\n- ロードマップ、目次、生成状況、未作成の要素、情報源の信頼性など、制作工程を説明するメタ文言\n\nタイトル、章名、ページ名と順序は変更しないでください。web_searchで信頼できる情報源を確認し、各ページに理解確認問題を1問、全体に暗記カードを8枚以上含めてください。本文blocksにはURL、Markdownリンク、出典の括弧書きを含めず、参照情報はsourcesだけに格納してください。blocksの未使用フィールドは空文字または空配列にしてください。`,
    "textbook",
    textbookSchema,
  );
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
    const jobRef = snap.ref;
    const bookRef = db.doc(`textbooks/${job.textbookId}`);
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
      const outline = await generateOutline(job.input);
      clearInterval(researchHeartbeat);
      researchHeartbeat = undefined;
      await heartbeatWrite;
      currentStage = "outlining";
      await updateGenerationStage(
        jobRef,
        bookRef,
        "outlining",
        30,
        "4章・12ページの構成を確認しています",
      );
      await Promise.all([
        jobRef.update({
          status: "awaiting_approval",
          progress: 35,
          stageDetail: "ロードマップと目次を確認してください",
          outline,
          outlineReadyAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
        bookRef.update({
          title: outline.title,
          subtitle: outline.subtitle,
          category: outline.category,
          generationStatus: "awaiting_approval",
          updatedAt: FieldValue.serverTimestamp(),
        }),
      ]);
      return;
    } catch (error) {
      if (researchHeartbeat) clearInterval(researchHeartbeat);
      await heartbeatWrite;
      console.error("outline_generation_failed", error);
      await Promise.all([
        jobRef.update({
          status: "failed",
          active: false,
          errorCode: "OUTLINE_GENERATION_FAILED",
          failedAtStage: currentStage,
          stageDetail: "ロードマップの生成中に問題が発生しました",
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

export const approveTextbookOutline = onCall(
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
      if (!job.exists || job.data()?.ownerId !== request.auth!.uid)
        throw new HttpsError("permission-denied", "承認する権限がありません");
      if (job.data()?.status !== "awaiting_approval")
        throw new HttpsError(
          "failed-precondition",
          "このロードマップは承認できません",
        );
      if (!job.data()?.outline)
        throw new HttpsError("failed-precondition", "ロードマップがありません");
      const bookRef = db.doc(`textbooks/${job.data()!.textbookId}`);
      tx.update(jobRef, {
        status: "approved",
        progress: 40,
        stageDetail: "承認を受け付けました。本文生成を開始します",
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(bookRef, {
        generationStatus: "approved",
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { approved: true };
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
          const quizRef = bookRef.collection("quizzes").doc();
          batch.set(quizRef, {
            ...p.quiz,
            pageId: pageRef.id,
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
