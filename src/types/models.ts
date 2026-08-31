export type ID = string;
export interface BaseEntity {
  id: ID;
  createdAt: string;
  updatedAt: string;
}
export type GenerationStatus =
  | "queued"
  | "researching"
  | "outlining"
  | "awaiting_approval"
  | "approved"
  | "writing"
  | "ready"
  | "finalizing"
  | "completed"
  | "superseded"
  | "failed";
export type OutlineQuickAction = "detailed" | "simple" | "practical";
export interface OutlineRevisionInput {
  jobId: ID;
  instruction: string;
  scope: "all" | "chapter";
  chapterIndex?: number;
  quickAction?: OutlineQuickAction;
  chapterCount?: number;
  pageCounts?: number[];
  level?: TextbookGenerationInput["level"];
  purpose?: TextbookGenerationInput["purpose"];
}
export interface TextbookRoadmapRegenerationInput extends Omit<
  OutlineRevisionInput,
  "jobId"
> {
  sourceTextbookId: ID;
  level: TextbookGenerationInput["level"];
  purpose: TextbookGenerationInput["purpose"];
}
export interface Source {
  title: string;
  url: string;
  accessedAt: string;
}
export interface TextbookGenerationInput {
  topic: string;
  level: "初心者" | "中級" | "上級" | "AIに任せる";
  purpose: "趣味" | "仕事" | "資格" | "教養";
  sourceTextbookId?: ID;
}
export interface GenerationJob extends BaseEntity {
  jobType?: "outline" | "chapter";
  ownerId: ID;
  textbookId: ID;
  chapterId?: ID;
  chapterOrder?: number;
  status: GenerationStatus;
  progress: number;
  input: TextbookGenerationInput;
  stageDetail?: string;
  startedAt?: string;
  elapsedSeconds?: number;
  errorCode?: string;
  failedAtStage?: GenerationStatus;
  firstPageId?: ID;
  outline?: TextbookOutline;
  approvedAt?: string;
  previousOutline?: TextbookOutline;
  previousInput?: TextbookGenerationInput;
  previousJobId?: ID;
  revision?: Omit<OutlineRevisionInput, "jobId">;
}
export interface TextbookOutlinePage {
  title: string;
  summary: string;
}
export interface TextbookOutlineChapter {
  title: string;
  summary: string;
  pages: TextbookOutlinePage[];
  sources?: { title: string; url: string }[];
}
export interface TextbookOutline {
  title: string;
  subtitle: string;
  category: string;
  chapters: TextbookOutlineChapter[];
}
export type ContentBlock =
  | { id: ID; type: "heading"; text: string; level: 2 | 3 }
  | { id: ID; type: "paragraph"; text: string }
  | { id: ID; type: "quote"; text: string; source?: string }
  | {
      id: ID;
      type: "callout";
      title: string;
      text: string;
      tone: "info" | "key";
    }
  | {
      id: ID;
      type: "timeline";
      items: { year: string; title: string; text: string }[];
    }
  | { id: ID; type: "table"; headers: string[]; rows: string[][] }
  | { id: ID; type: "image"; caption: string }
  | { id: ID; type: "formula"; formula: string }
  | { id: ID; type: "checklist"; items: string[] }
  | { id: ID; type: "code"; language: string; code: string }
  | { id: ID; type: "video"; title: string }
  | { id: ID; type: "question"; prompt: string }
  | { id: ID; type: "flashcard"; front: string; back: string }
  | { id: ID; type: "ai"; title: string; text: string };
export interface Page extends BaseEntity {
  chapterId: ID;
  title: string;
  order: number;
  readMinutes: number;
  blocks: ContentBlock[];
  sources?: Source[];
}
export interface Chapter extends BaseEntity {
  textbookId: ID;
  title: string;
  order: number;
  pageIds: ID[];
  progress: number;
  generationStatus?:
    "pending" | "queued" | "generating" | "completed" | "failed";
  generationProgress?: number;
  elapsedSeconds?: number;
  errorCode?: string;
}
export interface Textbook extends BaseEntity {
  ownerId?: ID;
  title: string;
  subtitle: string;
  category: string;
  cover: string;
  progress: number;
  favorite: boolean;
  chapterIds: ID[];
  generationStatus?: GenerationStatus;
  firstPageId?: ID;
  topic?: string;
  level?: TextbookGenerationInput["level"];
  purpose?: TextbookGenerationInput["purpose"];
  sourceTextbookId?: ID;
  generationJobId?: ID;
  generatedChapterCount?: number;
  nextChapterOrder?: number;
  activeChapterId?: ID;
  outline?: TextbookOutline;
}
export interface Quiz extends BaseEntity {
  pageId?: ID;
  chapterId?: ID;
  order?: number;
  type: "choice" | "truefalse" | "written" | "code";
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
}
export interface QuizAttempt extends BaseEntity {
  quizId: ID;
  response: string;
  correct: boolean;
}
export interface Flashcard extends BaseEntity {
  textbookId: ID;
  chapterId?: ID;
  front: string;
  back: string;
  mastery: number;
  nextReviewAt?: string;
}
export interface Note extends BaseEntity {
  ownerId: ID;
  textbookId: ID;
  pageId: ID;
  text: string;
  quote?: string;
}
export interface Highlight extends BaseEntity {
  ownerId: ID;
  textbookId: ID;
  pageId: ID;
  text: string;
  color: string;
}
export interface Bookmark extends BaseEntity {
  textbookId: ID;
  pageId: ID;
}
export interface UserProgress extends BaseEntity {
  textbookId: ID;
  pageId: ID;
  percent: number;
  studyMinutes?: number;
  streak?: number;
}
export interface KnowledgeNode {
  id: ID;
  label: string;
  type: "era" | "event" | "person" | "place";
  x: number;
  y: number;
  status: "done" | "current" | "locked";
}
export interface KnowledgeEdge {
  id: ID;
  source: ID;
  target: ID;
}
export interface LearningRoadmap {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}
export interface AIConversation extends BaseEntity {
  pageId: ID;
  messages: { id: ID; role: "user" | "assistant"; text: string }[];
}
export interface AIConversationRequest {
  textbookId: ID;
  pageId: ID;
  prompt: string;
}
export interface Activity extends BaseEntity {
  title: string;
  detail: string;
  kind: "read" | "quiz" | "card";
}
