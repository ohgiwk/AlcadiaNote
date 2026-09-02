import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";

let environment;
const alice = "alice";
const bob = "bob";

const base = (ownerId, overrides = {}) => ({
  ownerId,
  textbookId: "book-1",
  pageId: "page-1",
  createdAt: Timestamp.fromMillis(1_000),
  updatedAt: Timestamp.fromMillis(1_000),
  ...overrides,
});

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-arcadia-test",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});

after(async () => {
  await environment?.cleanup();
});

test.beforeEach(async () => {
  await environment.clearFirestore();
});

test("owner can create and read valid learning state", async () => {
  const db = environment.authenticatedContext(alice).firestore();
  const bookmark = doc(db, `users/${alice}/bookmarks/bookmark-1`);
  await assertSucceeds(setDoc(bookmark, base(alice)));
  await assertSucceeds(getDoc(bookmark));
});

test("another user cannot read, create, or update owner data", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), `users/${alice}/notes/note-1`),
      base(alice, { text: "メモ", quote: "" }),
    );
  });
  const bobDb = environment.authenticatedContext(bob).firestore();
  await assertFails(getDoc(doc(bobDb, `users/${alice}/notes/note-1`)));
  await assertFails(
    setDoc(
      doc(bobDb, `users/${alice}/bookmarks/injected`),
      base(alice),
    ),
  );
  await assertFails(
    updateDoc(doc(bobDb, `users/${alice}/notes/note-1`), { text: "改ざん" }),
  );
});

test("create rejects forged ownership, extra fields, invalid types, and oversized text", async () => {
  const db = environment.authenticatedContext(alice).firestore();
  await assertFails(
    setDoc(doc(db, `users/${alice}/bookmarks/forged`), base(bob)),
  );
  await assertFails(
    setDoc(
      doc(db, `users/${alice}/bookmarks/extra`),
      base(alice, { role: "admin" }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db, `users/${alice}/progress/book-1`),
      base(alice, { percent: "100" }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db, `users/${alice}/notes/large`),
      base(alice, { text: "x".repeat(5_001), quote: "" }),
    ),
  );
});

test("update cannot change ownership, createdAt, or validated bounds", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), `users/${alice}/progress/book-1`),
      base(alice, { percent: 50 }),
    );
  });
  const db = environment.authenticatedContext(alice).firestore();
  const progress = doc(db, `users/${alice}/progress/book-1`);
  await assertFails(updateDoc(progress, { ownerId: bob }));
  await assertFails(
    updateDoc(progress, { createdAt: Timestamp.fromMillis(2_000) }),
  );
  await assertFails(updateDoc(progress, { percent: 101 }));
  await assertSucceeds(
    updateDoc(progress, { percent: 75, updatedAt: Timestamp.fromMillis(2_000) }),
  );
});

test("generated data is owner-readable but never client-writable", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "textbooks/book-1"), { ownerId: alice });
    await setDoc(doc(adminDb, "textbooks/book-1/pages/page-1"), {
      title: "本文",
    });
    await setDoc(doc(adminDb, "generationJobs/job-1"), { ownerId: alice });
  });
  const aliceDb = environment.authenticatedContext(alice).firestore();
  const bobDb = environment.authenticatedContext(bob).firestore();
  await assertSucceeds(getDoc(doc(aliceDb, "textbooks/book-1/pages/page-1")));
  await assertFails(getDoc(doc(bobDb, "textbooks/book-1/pages/page-1")));
  await assertFails(setDoc(doc(aliceDb, "textbooks/book-2"), { ownerId: alice }));
  await assertSucceeds(getDoc(doc(aliceDb, "generationJobs/job-1")));
  await assertFails(getDoc(doc(bobDb, "generationJobs/job-1")));
});

test("unauthenticated and unmatched collection access is denied", async () => {
  const guestDb = environment.unauthenticatedContext().firestore();
  const aliceDb = environment.authenticatedContext(alice).firestore();
  await assertFails(getDoc(doc(guestDb, "textbooks/book-1")));
  await assertFails(setDoc(doc(aliceDb, "unexpected/doc-1"), { value: true }));
  assert.ok(true);
});
