import { Bot, Check, Lightbulb, Play, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { ContentBlock, Highlight } from "../types/models";
import { withoutInlineLinks } from "../utils/text";

function highlighted(text: string, highlights: Highlight[]): ReactNode {
  const matches = highlights
    .map((item) => item.text.trim())
    .filter((item) => item && text.includes(item))
    .sort((a, b) => b.length - a.length);
  if (!matches.length) return text;
  const pattern = new RegExp(
    `(${matches.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );
  return text.split(pattern).map((part, index) =>
    matches.includes(part) ? (
      <mark className="saved-highlight" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function ContentRenderer({
  block,
  highlights = [],
}: {
  block: ContentBlock;
  highlights?: Highlight[];
}) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2>{highlighted(withoutInlineLinks(block.text), highlights)}</h2>
      ) : (
        <h3>{highlighted(withoutInlineLinks(block.text), highlights)}</h3>
      );
    case "paragraph": {
      const text = withoutInlineLinks(block.text);
      return text ? <p>{highlighted(text, highlights)}</p> : null;
    }
    case "quote":
      return (
        <blockquote>
          “{highlighted(withoutInlineLinks(block.text), highlights)}”
          {block.source && <cite>— {withoutInlineLinks(block.source)}</cite>}
        </blockquote>
      );
    case "callout":
      return (
        <aside className={`callout ${block.tone}`}>
          <Lightbulb size={19} />
          <div>
            <strong>{withoutInlineLinks(block.title)}</strong>
            <p>{highlighted(withoutInlineLinks(block.text), highlights)}</p>
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
                <strong>{withoutInlineLinks(x.title)}</strong>
                <p>{withoutInlineLinks(x.text)}</p>
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
                  <th key={x}>{withoutInlineLinks(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((x, j) => (
                    <td key={j}>{withoutInlineLinks(x)}</td>
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
          <figcaption>{withoutInlineLinks(block.caption)}</figcaption>
        </figure>
      );
    case "checklist":
      return (
        <ul className="checklist">
          {block.items.map((x) => (
            <li key={x}>
              <Check size={16} />
              {withoutInlineLinks(x)}
            </li>
          ))}
        </ul>
      );
    case "ai":
      return (
        <aside className="ai-block">
          <Sparkles size={18} />
          <div>
            <strong>{withoutInlineLinks(block.title)}</strong>
            <p>{withoutInlineLinks(block.text)}</p>
          </div>
        </aside>
      );
    case "question":
      return (
        <aside className="question-block">
          <strong>考えてみよう</strong>
          <p>{highlighted(withoutInlineLinks(block.prompt), highlights)}</p>
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
          <Play /> {withoutInlineLinks(block.title)}
        </div>
      );
    case "flashcard":
      return (
        <div className="inline-card">
          <strong>{withoutInlineLinks(block.front)}</strong>
          <span>{withoutInlineLinks(block.back)}</span>
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
