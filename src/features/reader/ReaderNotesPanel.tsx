import { Bold, Italic, List, ListOrdered, Quote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { savePageNote } from "../../services/firebaseService";
import type { Note } from "../../types/models";

const allowedTags = new Set([
  "B", "STRONG", "I", "EM", "U", "P", "DIV", "BR", "UL", "OL", "LI", "BLOCKQUOTE",
]);

function sanitizeHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  for (const element of [...template.content.querySelectorAll("*")]) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ""));
      continue;
    }
    for (const attribute of [...element.attributes])
      element.removeAttribute(attribute.name);
  }
  return template.innerHTML.slice(0, 5000);
}

function escapeHtml(value: string) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

export function ReaderNotesPanel({
  uid,
  textbookId,
  pageId,
  note,
  quote,
  onQuoteInserted,
}: {
  uid?: string;
  textbookId: string;
  pageId: string;
  note?: Note;
  quote?: string;
  onQuoteInserted?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSaved = useRef("");
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");

  const persist = useCallback(
    async (html: string) => {
      if (!uid || html === lastSaved.current) return;
      try {
        await savePageNote(uid, textbookId, pageId, html, note?.id);
        lastSaved.current = html;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    },
    [note, pageId, textbookId, uid],
  );

  const scheduleSave = useCallback(
    (rawHtml: string) => {
      if (!uid) return;
      const html = sanitizeHtml(rawHtml);
      if (html === lastSaved.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus("saving");
      saveTimer.current = setTimeout(() => void persist(html), 600);
    },
    [persist, uid],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const initial = sanitizeHtml(note?.text ?? "");
    if (editor.innerHTML !== initial) editor.innerHTML = initial;
    lastSaved.current = initial;
  }, [note?.text, pageId]);

  useEffect(() => {
    if (!quote || !editorRef.current) return;
    const editor = editorRef.current;
    editor.innerHTML = sanitizeHtml(
      `${editor.innerHTML}<blockquote>${escapeHtml(quote)}</blockquote><p><br></p>`,
    );
    editor.focus();
    scheduleSave(editor.innerHTML);
    onQuoteInserted?.();
  }, [onQuoteInserted, quote, scheduleSave]);

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        const html = sanitizeHtml(editorRef.current?.innerHTML ?? "");
        void persist(html);
      }
    },
    [persist],
  );

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    scheduleSave(editorRef.current?.innerHTML ?? "");
  }

  const tools = [
    { command: "bold", label: "太字", icon: Bold },
    { command: "italic", label: "斜体", icon: Italic },
    { command: "insertUnorderedList", label: "箇条書き", icon: List },
    { command: "insertOrderedList", label: "番号付きリスト", icon: ListOrdered },
    { command: "formatBlock", value: "blockquote", label: "引用", icon: Quote },
  ];

  return (
    <aside className="reader-notes-panel">
      <header>
        <div>
          <span className="eyebrow">NOTEBOOK</span>
          <h2>このページのノート</h2>
        </div>
        <span className={`note-save-status ${status}`}>
          {status === "saving"
            ? "保存中…"
            : status === "error"
              ? "保存できませんでした"
              : "保存済み"}
        </span>
      </header>
      <div className="note-format-toolbar" role="toolbar" aria-label="ノートの書式">
        {tools.map(({ command, value, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(command, value)}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        className="rich-note-editor"
        contentEditable={Boolean(uid)}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="このページで気づいたことを自由に書いてください…"
        onInput={(event) => scheduleSave(event.currentTarget.innerHTML)}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
        }}
      />
    </aside>
  );
}
