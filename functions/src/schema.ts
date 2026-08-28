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
    type: { type: "string", enum: ["choice", "truefalse", "written"] },
    prompt: { type: "string" },
    options: stringArray,
    answer: { type: "string" },
    explanation: { type: "string" },
  },
} as const;
const page = {
  type: "object",
  additionalProperties: false,
  required: ["title", "readMinutes", "blocks", "sources", "quiz"],
  properties: {
    title: { type: "string" },
    readMinutes: { type: "integer" },
    blocks: { type: "array", items: block },
    sources: { type: "array", items: source },
    quiz,
  },
} as const;
const chapter = {
  type: "object",
  additionalProperties: false,
  required: ["title", "pages"],
  properties: {
    title: { type: "string" },
    pages: { type: "array", minItems: 3, maxItems: 3, items: page },
  },
} as const;
const flashcard = {
  type: "object",
  additionalProperties: false,
  required: ["front", "back"],
  properties: { front: { type: "string" }, back: { type: "string" } },
} as const;
export const textbookSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "category", "chapters", "flashcards"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    category: { type: "string" },
    chapters: { type: "array", minItems: 4, maxItems: 4, items: chapter },
    flashcards: { type: "array", minItems: 8, items: flashcard },
  },
} as const;
