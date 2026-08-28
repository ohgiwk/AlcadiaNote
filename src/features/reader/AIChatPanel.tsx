import {
  ArrowUp,
  Bot,
  Layers3,
  Lightbulb,
  ListChecks,
  Network,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { askPageQuestion } from "../../services/firebaseService";
const actions = [
  ["もっと簡単に", Lightbulb],
  ["例を追加", Layers3],
  ["図で説明", Network],
  ["問題を作る", ListChecks],
] as const;
export function AIChatPanel({
  textbookId,
  pageId,
}: {
  textbookId: string;
  pageId: string;
}) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([{ role: "assistant", text: "このページについて何でも聞いてください。" }]);
  const [value, setValue] = useState("");
  const [thinking, setThinking] = useState(false);
  async function send(prompt = value) {
    if (!prompt.trim() || thinking) return;
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setValue("");
    setThinking(true);
    try {
      const answer = await askPageQuestion({ textbookId, pageId, prompt });
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "回答を生成できませんでした。時間をおいてもう一度お試しください。",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }
  return (
    <aside className="ai-panel">
      <header>
        <span>
          <Sparkles size={17} />
          Arcadia AI
        </span>
        <i>このページを参照中</i>
      </header>
      <div className="chat-scroll">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.role === "assistant" && <Bot size={16} />}
            <p>{m.text}</p>
          </div>
        ))}
        {thinking && (
          <div className="message assistant typing">
            <Bot size={16} />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="quick-actions">
        {actions.map(([label, I]) => (
          <button key={label} onClick={() => void send(label)}>
            <I size={15} />
            {label}
          </button>
        ))}
      </div>
      <div className="chat-input">
        <textarea
          maxLength={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="このページについて質問…"
        />
        <button onClick={() => void send()} aria-label="送信">
          <ArrowUp size={18} />
        </button>
      </div>
    </aside>
  );
}
