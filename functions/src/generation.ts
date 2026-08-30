import { chapterContentSchema, textbookOutlineSchema } from "./schema.js";
import { structuredGeneration } from "./openai.js";
import {
  containsGenerationMeta,
  withoutInlineLinks,
  withoutPageNumberPrefix,
} from "./sanitize.js";
import type {
  GeneratedBlock,
  GeneratedChapter,
  GenerationResult,
  OutlineChapter,
  TextbookGenerationInput,
  TextbookOutline,
} from "./types.js";

interface GenerationConfig {
  apiKey: string;
  model: string;
}

export async function generateOutline(
  config: GenerationConfig,
  input: TextbookGenerationInput,
): Promise<GenerationResult<TextbookOutline>> {
  const generated = await structuredGeneration<TextbookOutline>({
    ...config,
    prompt: `日本語の学習用教科書のロードマップと目次だけを作成してください。テーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n正確性を優先し、web_searchで信頼できる情報源を調査してください。全4章、各章3ページとし、章とページごとに具体的な要約を付け、各章に本文生成で再利用できる信頼性の高い参照元を3〜6件格納してください。タイトル・要約にはURL、Markdownリンク、ドメイン名や出典の括弧書きを含めないでください。本文、問題、暗記カードはまだ作成しないでください。`,
    name: "textbook_outline",
    schema: textbookOutlineSchema,
  });
  const outline = generated.data;
  return {
    meta: generated.meta,
    data: {
      title: withoutInlineLinks(outline.title),
      subtitle: containsGenerationMeta(outline.subtitle)
        ? `${input.topic}を体系的に学ぶ教科書`
        : withoutInlineLinks(outline.subtitle),
      category: withoutInlineLinks(outline.category),
      chapters: outline.chapters.map((chapter) => ({
        title: withoutInlineLinks(chapter.title),
        summary: withoutInlineLinks(chapter.summary),
        pages: chapter.pages.map((page) => ({
          title: withoutPageNumberPrefix(withoutInlineLinks(page.title)),
          summary: withoutInlineLinks(page.summary),
        })),
        sources: chapter.sources.map((source) => ({
          title: withoutInlineLinks(source.title),
          url: String(source.url),
        })),
      })),
    },
  };
}

export function generateChapter(
  config: GenerationConfig,
  input: TextbookGenerationInput,
  chapter: OutlineChapter,
  chapterOrder: number,
) {
  const hasResearch = chapter.sources.length > 0;
  return structuredGeneration<GeneratedChapter>({
    ...config,
    prompt: `あなたは高品質な教科書を執筆する専門家です。第${chapterOrder}章だけを生成してください。\nテーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n承認済み章構成: ${JSON.stringify(chapter)}\n各ページは構成の順番とタイトルを守り、800〜1,200文字を目安に、見出し2〜4個、定義、理由、具体例、背景、因果関係を含めて体系的に説明してください。冗長な水増し、不要な前置き、制作工程のメタ文言は禁止です。章の3ページを横断する選択式または正誤式の確認問題を5問、章の暗記カードを2枚作成してください。本文にURLや出典表記を含めず、参照情報はsourcesだけに格納してください。`,
    name: "chapter_content",
    schema: chapterContentSchema,
    useWebSearch: !hasResearch,
  });
}

export function toContentBlock(raw: GeneratedBlock) {
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
    case "checklist":
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
        rows: raw.rows.map((row) => row.map(withoutInlineLinks)),
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
