import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type {
  AIConversationRequest,
  OutlineRevisionInput,
  TextbookRoadmapRegenerationInput,
  TextbookGenerationInput,
} from "../types/models";
export async function createTextbook(input: TextbookGenerationInput) {
  return (
    await httpsCallable<
      TextbookGenerationInput,
      { jobId: string; textbookId: string }
    >(
      functions,
      "createTextbook",
    )(input)
  ).data;
}
export async function createTextbookFromRoadmap(
  input: TextbookRoadmapRegenerationInput,
) {
  const { sourceTextbookId, level, purpose, ...revision } = input;
  return (
    await httpsCallable<
      TextbookGenerationInput & {
        revision: Omit<OutlineRevisionInput, "jobId">;
      },
      { jobId: string; textbookId: string }
    >(
      functions,
      "createTextbook",
    )({
      topic: "regeneration",
      sourceTextbookId,
      level,
      purpose,
      revision: { ...revision, level, purpose },
    })
  ).data;
}
export async function approveTextbookOutline(jobId: string) {
  return (
    await httpsCallable<
      { jobId: string },
      { approved: boolean; jobId: string }
    >(
      functions,
      "approveTextbookOutline",
    )({ jobId })
  ).data;
}
export async function reviseTextbookOutline(input: OutlineRevisionInput) {
  return (
    await httpsCallable<OutlineRevisionInput, { jobId: string }>(
      functions,
      "reviseTextbookOutline",
    )(input)
  ).data;
}
export async function restorePreviousTextbookOutline(jobId: string) {
  return (
    await httpsCallable<
      { jobId: string },
      { restored: boolean; jobId: string }
    >(
      functions,
      "restorePreviousTextbookOutline",
    )({ jobId })
  ).data;
}
export async function requestNextChapterGeneration(textbookId: string) {
  return (
    await httpsCallable<{ textbookId: string }, { jobId: string }>(
      functions,
      "requestNextChapterGeneration",
    )({ textbookId })
  ).data;
}
export async function askPageQuestion(input: AIConversationRequest) {
  return (
    await httpsCallable<AIConversationRequest, { answer: string }>(
      functions,
      "askPageQuestion",
    )(input)
  ).data.answer;
}
export async function deleteTextbook(textbookId: string) {
  return (
    await httpsCallable<{ textbookId: string }, { deleted: boolean }>(
      functions,
      "deleteTextbook",
    )({ textbookId })
  ).data;
}
export async function toggleBookmark(
  uid: string,
  textbookId: string,
  pageId: string,
) {
  const found = await getDocs(
    query(
      collection(db, `users/${uid}/bookmarks`),
      where("ownerId", "==", uid),
      where("textbookId", "==", textbookId),
      where("pageId", "==", pageId),
    ),
  );
  if (!found.empty) {
    await Promise.all(found.docs.map((x) => deleteDoc(x.ref)));
    return false;
  }
  const ref = doc(collection(db, `users/${uid}/bookmarks`));
  await setDoc(ref, {
    ownerId: uid,
    textbookId,
    pageId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return true;
}
export async function savePageNote(
  uid: string,
  textbookId: string,
  pageId: string,
  text: string,
  noteId?: string,
) {
  const ref = noteId
    ? doc(db, `users/${uid}/notes/${noteId}`)
    : doc(db, `users/${uid}/notes/${textbookId}__${pageId}`);
  if (noteId) {
    await updateDoc(ref, {
      text,
      quote: "",
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await setDoc(ref, {
    ownerId: uid,
    textbookId,
    pageId,
    text,
    quote: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function addHighlight(
  uid: string,
  textbookId: string,
  pageId: string,
  text: string,
  color = "yellow",
) {
  const ref = doc(collection(db, `users/${uid}/highlights`));
  await setDoc(ref, {
    ownerId: uid,
    textbookId,
    pageId,
    text,
    color,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function deleteHighlight(uid: string, highlightId: string) {
  await deleteDoc(doc(db, `users/${uid}/highlights/${highlightId}`));
}
export async function saveProgress(
  uid: string,
  textbookId: string,
  pageId: string,
  percent: number,
  options: { allowPercentDecrease?: boolean } = {},
) {
  const progressRef = doc(db, `users/${uid}/progress/${textbookId}`);
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(progressRef);
    if (
      current.exists() &&
      Number(current.data().percent ?? 0) >= percent &&
      !options.allowPercentDecrease
    ) {
      transaction.update(progressRef, { updatedAt: serverTimestamp() });
      return;
    }
    const data = {
      ownerId: uid,
      textbookId,
      pageId,
      percent,
      updatedAt: serverTimestamp(),
    };
    if (current.exists()) {
      transaction.update(progressRef, data);
    } else {
      transaction.set(progressRef, {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  });
}
export async function saveQuizAttempt(
  uid: string,
  textbookId: string,
  quizId: string,
  response: string,
  correct: boolean,
) {
  const ref = doc(collection(db, `users/${uid}/quizAttempts`));
  await setDoc(ref, {
    ownerId: uid,
    textbookId,
    quizId,
    response,
    correct,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function rateFlashcard(
  uid: string,
  textbookId: string,
  cardId: string,
  mastery: number,
) {
  await setDoc(
    doc(db, `users/${uid}/flashcardProgress/${cardId}`),
    {
      ownerId: uid,
      textbookId,
      cardId,
      mastery,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}
