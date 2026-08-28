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
  | "writing"
  | "finalizing"
  | "completed"
  | "failed";
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
  ownerId: ID;
  textbookId: ID;
  status: GenerationStatus;
  progress: number;
  input: TextbookGenerationInput;
  errorCode?: string;
  firstPageId?: ID;
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
}
export interface Quiz extends BaseEntity {
  pageId: ID;
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
  front: string;
  back: string;
  mastery: number;
  nextReviewAt?: string;
}
export interface Note extends BaseEntity {
  pageId: ID;
  text: string;
  quote?: string;
}
export interface Highlight extends BaseEntity {
  pageId: ID;
  text: string;
  color: string;
}
export interface Bookmark extends BaseEntity {
  pageId: ID;
}
export interface UserProgress extends BaseEntity {
  textbookId: ID;
  pageId: ID;
  percent: number;
  studyMinutes: number;
  streak: number;
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
