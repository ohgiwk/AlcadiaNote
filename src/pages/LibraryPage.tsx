import { where } from "firebase/firestore";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { BookCover } from "../components/BookCover";
import { useCollection } from "../hooks/useFirestoreData";
import { deleteTextbook } from "../services/firebaseService";
import type {
  Textbook,
  TextbookGenerationInput,
  UserProgress,
} from "../types/models";

type SortOrder = "recent-learning" | "newest" | "oldest" | "title" | "progress";

function timestamp(value?: string) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("すべて");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent-learning");
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const {
    data: textbooks,
    loading,
    error,
  } = useCollection<Textbook>(
    "textbooks",
    user ? [where("ownerId", "==", user.uid)] : [],
  );
  const { data: progressEntries } = useCollection<UserProgress>(
    user ? `users/${user.uid}/progress` : "__none__",
    user ? [where("ownerId", "==", user.uid)] : [],
  );
  const progressByTextbook = useMemo(
    () =>
      new Map(
        progressEntries.map((entry) => [entry.textbookId, entry.percent]),
      ),
    [progressEntries],
  );
  const lastLearnedByTextbook = useMemo(
    () =>
      new Map(
        progressEntries.map((entry) => [entry.textbookId, entry.updatedAt]),
      ),
    [progressEntries],
  );
  const categories = ["すべて", ...new Set(textbooks.map((x) => x.category))];
  const list = useMemo(() => {
    const filtered = textbooks.filter(
      (x) =>
        (filter === "すべて" || x.category === filter) &&
        (x.title.includes(q) || x.subtitle.includes(q)),
    );
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case "recent-learning":
          return (
            timestamp(lastLearnedByTextbook.get(b.id)) -
              timestamp(lastLearnedByTextbook.get(a.id)) ||
            timestamp(b.createdAt) - timestamp(a.createdAt)
          );
        case "oldest":
          return timestamp(a.createdAt) - timestamp(b.createdAt);
        case "title":
          return a.title.localeCompare(b.title, "ja");
        case "progress":
          return (
            (progressByTextbook.get(b.id) ?? 0) -
              (progressByTextbook.get(a.id) ?? 0) ||
            timestamp(b.createdAt) - timestamp(a.createdAt)
          );
        default:
          return timestamp(b.createdAt) - timestamp(a.createdAt);
      }
    });
  }, [
    q,
    filter,
    textbooks,
    sortOrder,
    progressByTextbook,
    lastLearnedByTextbook,
  ]);
  async function remove(book: Textbook) {
    if (
      !window.confirm(
        `「${book.title}」を削除しますか？\nこの操作は元に戻せません。`,
      )
    )
      return;
    setDeleteError("");
    setDeletingId(book.id);
    try {
      await deleteTextbook(book.id);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "教科書を削除できませんでした",
      );
    } finally {
      setDeletingId("");
    }
  }
  return (
    <div className="page">
      <section className="title-row">
        <div>
          <span className="eyebrow">MY COLLECTION</span>
          <h1>本棚</h1>
          <p>学びたいだけ、あなたの世界は広がっていく。</p>
        </div>
      </section>
      <div className="library-tools">
        <label>
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="本棚を検索"
          />
        </label>
        <div className="filter-pills">
          {categories.map((x) => (
            <button
              className={filter === x ? "active" : ""}
              onClick={() => setFilter(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <label className="sort">
          <SlidersHorizontal size={17} />
          <select
            value={sortOrder}
            aria-label="本棚の並び順"
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          >
            <option value="recent-learning">最近学習した順</option>
            <option value="newest">最近作成した順</option>
            <option value="oldest">作成が古い順</option>
            <option value="title">タイトル順</option>
            <option value="progress">進捗が高い順</option>
          </select>
        </label>
      </div>
      {deleteError && <p className="form-error">{deleteError}</p>}
      {loading ? (
        <p>本棚を読み込んでいます…</p>
      ) : error ? (
        <p>本棚を読み込めませんでした。</p>
      ) : list.length === 0 ? (
        <p>まだ教科書がありません。「作る」から最初の一冊を生成しましょう。</p>
      ) : (
        <div className="book-grid library-grid">
          {list.map((x) => (
            <BookCover
              key={x.id}
              book={{
                ...x,
                progress: progressByTextbook.get(x.id) ?? 0,
              }}
              showGenerationConditions
              deleting={deletingId === x.id}
              onRegenerate={() =>
                navigate("/create", {
                  state: {
                    topic: x.topic ?? x.title,
                    level: x.level ?? "AIに任せる",
                    purpose: x.purpose ?? "教養",
                    sourceTextbookId: x.id,
                  } satisfies TextbookGenerationInput,
                })
              }
              onDelete={() => void remove(x)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
