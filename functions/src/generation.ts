import {
  buildAdaptiveTextbookOutlineSchema,
  buildChapterRevisionOutlineSchema,
  buildChapterContentSchema,
  buildTextbookOutlineSchema,
} from "./schema.js";
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
  OutlineRevision,
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
  revision?: OutlineRevision & { currentOutline: TextbookOutline },
): Promise<GenerationResult<TextbookOutline>> {
  const chapterCount = revision?.chapterCount;
  const pageCounts = revision?.pageCounts;
  const quickInstructions = {
    detailed: "説明範囲を広げ、より詳しく段階的な構成にしてください。",
    simple: "初学者が理解しやすい平易で焦点の絞られた構成にしてください。",
    practical: "具体例、応用、実践を重視した構成にしてください。",
  } as const;
  const revisionPrompt = revision
    ? `\n現在のロードマップ: ${JSON.stringify(revision.currentOutline)}\n調整対象: ${revision.scope === "chapter" ? `第${(revision.chapterIndex ?? 0) + 1}章のみ` : "全体"}\n調整指示: ${revision.instruction || "学習に適した構成へ調整"}${revision.quickAction ? `\n追加指示: ${quickInstructions[revision.quickAction]}` : ""}\n「詳しく」の場合は理解に必要であれば章数やページ数を増やし、「簡単に」の場合は重要な学習内容を保ちながら必要に応じて章数やページ数を減らしてください。章数は2〜8章、各章は1〜8ページの範囲とし、対象外の章の内容は変更しないでください。`
    : "";
  const generated = await structuredGeneration<TextbookOutline>({
    ...config,
    prompt: `日本語の学習用教科書のロードマップと目次だけを作成してください。テーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n正確性を優先し、web_searchで信頼できる情報源を調査してください。${revision && chapterCount && pageCounts ? `全${chapterCount}章、章ごとのページ数は順に${pageCounts.join("、")}ページとし、各章は指定ページ数を厳守してください。` : "テーマの範囲、内容の複雑さ、難易度、学習目的に応じて、過不足なく学べる章数と各章のページ数を決めてください。章数は2〜8章、各章は1〜8ページの範囲にしてください。すべてを上限まで増やすのではなく、学習に本当に必要な分量を選んでください。"}章とページごとに具体的な要約を付け、各章に本文生成で再利用できる信頼性の高い参照元を3〜6件格納してください。タイトル・要約にはURL、Markdownリンク、ドメイン名や出典の括弧書きを含めないでください。本文、問題、暗記カードはまだ作成しないでください。${revisionPrompt}`,
    name: "textbook_outline",
    schema:
      revision && chapterCount && pageCounts
        ? buildTextbookOutlineSchema(chapterCount, pageCounts)
        : revision?.scope === "chapter"
          ? buildChapterRevisionOutlineSchema(
              revision.currentOutline.chapters.length,
            )
          : buildAdaptiveTextbookOutlineSchema(),
  });
  const outline = generated.data;
  if (
    revision &&
    chapterCount &&
    pageCounts &&
    (outline.chapters.length !== chapterCount ||
      outline.chapters.some(
        (chapter, index) => chapter.pages.length !== pageCounts[index],
      ))
  )
    throw new Error("invalid_outline_dimensions");
  const resolvedOutline =
    revision?.scope === "chapter" && revision.chapterIndex !== undefined
      ? {
          ...revision.currentOutline,
          chapters: revision.currentOutline.chapters.map((chapter, index) =>
            index === revision.chapterIndex ? outline.chapters[index] : chapter,
          ),
        }
      : outline;
  return {
    meta: generated.meta,
    data: {
      title: withoutInlineLinks(resolvedOutline.title),
      subtitle: containsGenerationMeta(resolvedOutline.subtitle)
        ? `${input.topic}を体系的に学ぶ教科書`
        : withoutInlineLinks(resolvedOutline.subtitle),
      category: withoutInlineLinks(resolvedOutline.category),
      chapters: resolvedOutline.chapters.map((chapter) => ({
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
    prompt: `あなたは高品質な教科書を執筆する専門家です。第${chapterOrder}章だけを生成してください。\nテーマ: ${input.topic}\n難易度: ${input.level}\n目的: ${input.purpose}\n承認済み章構成: ${JSON.stringify(chapter)}\n各ページは構成の順番とタイトルを守り、800〜1,200文字を目安に、見出し2〜4個、定義、理由、具体例、背景、因果関係を含めて体系的に説明してください。プログラミング、設定、コマンド、マークアップなどを例示する場合はcodeブロックを使い、textに実際のコードを、languageに言語名（javascript、python、bash、htmlなど）を格納してください。code以外のブロックではlanguageを空文字にしてください。冗長な水増し、不要な前置き、制作工程のメタ文言は禁止です。章の${chapter.pages.length}ページを横断する選択式または正誤式の確認問題を5問、章の暗記カードを2枚作成してください。本文にURLや出典表記を含めず、参照情報はsourcesだけに格納してください。`,
    name: "chapter_content",
    schema: buildChapterContentSchema(chapter.pages.length),
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
      return {
        id,
        type: "code",
        language:
          raw.language
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9+#.-]/g, "") || "text",
        code: raw.text,
      };
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
