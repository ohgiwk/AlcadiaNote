export type LearningLevel = "初心者" | "中級" | "上級" | "AIに任せる";
export type LearningPurpose = "趣味" | "仕事" | "資格" | "教養";

export interface TextbookGenerationInput {
  topic: string;
  level: LearningLevel;
  purpose: LearningPurpose;
  sourceTextbookId?: string;
}

export type OutlineQuickAction = "detailed" | "simple" | "practical";

export interface OutlineRevision {
  instruction: string;
  scope: "all" | "chapter";
  chapterIndex?: number;
  quickAction?: OutlineQuickAction;
  chapterCount?: number;
  pageCounts?: number[];
  level?: LearningLevel;
  purpose?: LearningPurpose;
}

export interface OutlineSource {
  title: string;
  url: string;
}

export interface OutlinePage {
  title: string;
  summary: string;
}

export interface OutlineChapter {
  title: string;
  summary: string;
  pages: OutlinePage[];
  sources: OutlineSource[];
}

export interface TextbookOutline {
  title: string;
  subtitle: string;
  category: string;
  chapters: OutlineChapter[];
}

export interface GeneratedBlock {
  type: string;
  text: string;
  title: string;
  items: string[];
  headers: string[];
  rows: string[][];
}

export interface GeneratedSource {
  title: string;
  url: string;
}

export interface GeneratedPage {
  title: string;
  readMinutes: number;
  blocks: GeneratedBlock[];
  sources: GeneratedSource[];
}

export interface GeneratedQuiz {
  type: "choice" | "truefalse";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export interface GeneratedChapter {
  pages: GeneratedPage[];
  quizzes: GeneratedQuiz[];
  flashcards: GeneratedFlashcard[];
}

export interface OpenAIMetadata {
  responseId: string;
  durationMs: number;
  usage: Record<string, unknown>;
  serviceTier: string;
  webSearchCalls: number;
}

export interface GenerationResult<T> {
  data: T;
  meta: OpenAIMetadata;
}
