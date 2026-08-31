const stringArray = { type: "array", items: { type: "string" } } as const;
const block = {
  type: "object",
  additionalProperties: false,
  required: ["type", "text", "title", "items", "headers", "rows"],
  properties: {
    type: {
      type: "string",
      enum: [
        "heading",
        "paragraph",
        "callout",
        "timeline",
        "table",
        "checklist",
        "code",
        "question",
        "quote",
        "formula",
        "ai",
      ],
    },
    text: { type: "string" },
    title: { type: "string" },
    items: stringArray,
    headers: stringArray,
    rows: { type: "array", items: stringArray },
  },
} as const;
const source = {
  type: "object",
  additionalProperties: false,
  required: ["title", "url"],
  properties: { title: { type: "string" }, url: { type: "string" } },
} as const;
const quiz = {
  type: "object",
  additionalProperties: false,
  required: ["type", "prompt", "options", "answer", "explanation"],
  properties: {
    type: { type: "string", enum: ["choice", "truefalse"] },
    prompt: { type: "string" },
    options: stringArray,
    answer: { type: "string" },
    explanation: { type: "string" },
  },
} as const;
const page = {
  type: "object",
  additionalProperties: false,
  required: ["title", "readMinutes", "blocks", "sources"],
  properties: {
    title: { type: "string" },
    readMinutes: { type: "integer" },
    blocks: { type: "array", items: block },
    sources: { type: "array", minItems: 1, maxItems: 6, items: source },
  },
} as const;
const flashcard = {
  type: "object",
  additionalProperties: false,
  required: ["front", "back"],
  properties: { front: { type: "string" }, back: { type: "string" } },
} as const;
const outlinePage = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
  },
} as const;
const outlineChapter = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "pages", "sources"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    pages: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: outlinePage,
    },
    sources: { type: "array", minItems: 3, maxItems: 6, items: source },
  },
} as const;
export function buildChapterContentSchema(pageCount = 3) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["pages", "quizzes", "flashcards"],
    properties: {
      pages: {
        type: "array",
        minItems: pageCount,
        maxItems: pageCount,
        items: page,
      },
      quizzes: { type: "array", minItems: 5, maxItems: 5, items: quiz },
      flashcards: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: flashcard,
      },
    },
  } as const;
}
export function buildTextbookOutlineSchema(
  chapterCount = 4,
  pageCounts = Array(chapterCount).fill(3),
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "subtitle", "category", "chapters"],
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      category: { type: "string" },
      chapters: {
        type: "array",
        minItems: chapterCount,
        maxItems: chapterCount,
        items: {
          ...outlineChapter,
          properties: {
            ...outlineChapter.properties,
            pages: {
              ...outlineChapter.properties.pages,
              minItems: Math.min(...pageCounts),
              maxItems: Math.max(...pageCounts),
            },
          },
        },
      },
    },
  } as const;
}

export function buildAdaptiveTextbookOutlineSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "subtitle", "category", "chapters"],
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      category: { type: "string" },
      chapters: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        items: {
          ...outlineChapter,
          properties: {
            ...outlineChapter.properties,
            pages: {
              ...outlineChapter.properties.pages,
              minItems: 1,
              maxItems: 8,
            },
          },
        },
      },
    },
  } as const;
}

export function buildChapterRevisionOutlineSchema(chapterCount: number) {
  const schema = buildAdaptiveTextbookOutlineSchema();
  return {
    ...schema,
    properties: {
      ...schema.properties,
      chapters: {
        ...schema.properties.chapters,
        minItems: chapterCount,
        maxItems: chapterCount,
      },
    },
  } as const;
}

export const chapterContentSchema = buildChapterContentSchema();
export const textbookOutlineSchema = buildTextbookOutlineSchema();
