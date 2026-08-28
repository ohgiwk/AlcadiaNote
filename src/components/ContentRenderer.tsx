import { Bot, Check, Lightbulb, Play, Sparkles } from "lucide-react";
import type { ContentBlock } from "../types/models";
export function ContentRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? <h2>{block.text}</h2> : <h3>{block.text}</h3>;
    case "paragraph":
      return (
        <p contentEditable suppressContentEditableWarning>
          {block.text}
        </p>
      );
    case "quote":
      return (
        <blockquote>
          “{block.text}”{block.source && <cite>— {block.source}</cite>}
        </blockquote>
      );
    case "callout":
      return (
        <aside className={`callout ${block.tone}`}>
          <Lightbulb size={19} />
          <div>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </div>
        </aside>
      );
    case "timeline":
      return (
        <div className="timeline">
          {block.items.map((x) => (
            <div key={x.year}>
              <time>{x.year}</time>
              <span />
              <section>
                <strong>{x.title}</strong>
                <p>{x.text}</p>
              </section>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {block.headers.map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((x, j) => (
                    <td key={j}>{x}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "image":
      return (
        <figure className="diagram">
          <div>
            <span>熱エネルギー</span>
            <b>→</b>
            <span>蒸気圧</span>
            <b>→</b>
            <span>機械運動</span>
          </div>
          <figcaption>{block.caption}</figcaption>
        </figure>
      );
    case "checklist":
      return (
        <ul className="checklist">
          {block.items.map((x) => (
            <li key={x}>
              <Check size={16} />
              {x}
            </li>
          ))}
        </ul>
      );
    case "ai":
      return (
        <aside className="ai-block">
          <Sparkles size={18} />
          <div>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </div>
        </aside>
      );
    case "question":
      return (
        <aside className="question-block">
          <strong>考えてみよう</strong>
          <p>{block.prompt}</p>
        </aside>
      );
    case "formula":
      return <div className="formula">{block.formula}</div>;
    case "code":
      return (
        <pre>
          <code>{block.code}</code>
        </pre>
      );
    case "video":
      return (
        <div className="video">
          <Play /> {block.title}
        </div>
      );
    case "flashcard":
      return (
        <div className="inline-card">
          <strong>{block.front}</strong>
          <span>{block.back}</span>
        </div>
      );
    default:
      return (
        <div>
          <Bot /> AI block
        </div>
      );
  }
}
