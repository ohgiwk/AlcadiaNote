import { Bot, Highlighter, NotebookPen, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { ContentRenderer } from "../components/ContentRenderer";
import { useCollection } from "../hooks/useFirestoreData";
import { useTextbook } from "../hooks/useTextbook";
import { addNote } from "../services/firebaseService";
import type { Note } from "../types/models";
import { withoutPageNumberPrefix } from "../utils/text";
export function NotesPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { book, pages, loading } = useTextbook(id);
  const page = pages[0];
  const { data: notes } = useCollection<Note>(`users/${user?.uid}/notes`, {
    enabled: Boolean(user),
  });
  const [saving, setSaving] = useState(false);
  async function add(text: string) {
    if (!user || !page) return;
    setSaving(true);
    await addNote(user.uid, id, page.id, text);
    setSaving(false);
  }
  if (loading) return <div className="page">読み込んでいます…</div>;
  if (!book || !page) return <div className="page">ページがありません。</div>;
  const pageNotes = notes.filter((n) => n.pageId === page.id);
  return (
    <div className="notes-layout">
      <section className="notes-paper">
        <Link to={`/textbooks/${id}/read/${page.id}`} className="back-link">
          ← 読書に戻る
        </Link>
        <article className="paper">
          <span className="chapter-label">NOTE MODE</span>
          <h1>{withoutPageNumberPrefix(page.title)}</h1>
          <div className="context-menu">
            <button>
              <Highlighter />
              マーカー
            </button>
            <button disabled={saving} onClick={() => void add("新しい気づき")}>
              <NotebookPen />
              ノート
            </button>
            <button>
              <Bot />
              AIへ質問
            </button>
          </div>
          {page.blocks.slice(0, 4).map((b) => (
            <ContentRenderer key={b.id} block={b} />
          ))}
        </article>
      </section>
      <aside className="notebook">
        <header>
          <div>
            <span className="eyebrow">NOTEBOOK</span>
            <h2>このページのノート</h2>
          </div>
          <button onClick={() => void add("新しい気づき")}>＋</button>
        </header>
        {pageNotes.length === 0 ? (
          <div className="empty-note">
            <NotebookPen />
            <p>ノートを残してみましょう。</p>
          </div>
        ) : (
          pageNotes.map((n) => (
            <article key={n.id}>
              <p>{n.text}</p>
            </article>
          ))
        )}
        <div className="ai-note">
          <Sparkles />
          <strong>AIチャットで要約できます</strong>
        </div>
      </aside>
    </div>
  );
}
