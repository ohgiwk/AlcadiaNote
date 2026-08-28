import type { Textbook } from "../types/models";
export interface AIService {
  generateTextbook(
    topic: string,
    onProgress: (step: number) => void,
  ): Promise<Textbook>;
  askQuestion(prompt: string): Promise<string>;
  summarize(text: string): Promise<string>;
  expandContent(text: string): Promise<string>;
  simplifyContent(text: string): Promise<string>;
  generateDiagram(topic: string): Promise<string>;
  generateQuiz(topic: string): Promise<string>;
  generateFlashcards(topic: string): Promise<string>;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const mockAIService: AIService = {
  async generateTextbook(topic, onProgress) {
    for (let i = 0; i < 4; i++) {
      await wait(650);
      onProgress(i + 1);
    }
    return {
      id: "industrial",
      title: topic || "産業革命と近代社会",
      subtitle: "AIが編んだ、あなた専用の教科書",
      category: "世界史",
      cover: "cobalt",
      progress: 0,
      favorite: false,
      chapterIds: ["c1", "c2", "c3"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  async askQuestion(prompt) {
    await wait(750);
    if (prompt.includes("簡単"))
      return "産業革命は、手作業中心の社会が機械中心へ切り替わった大きな変化です。ポイントは「発明ひとつ」ではなく、資源・お金・人・市場が同時にそろったことです。";
    if (prompt.includes("図"))
      return "流れで見ると：農業の効率化 → 人口増加 → 都市へ移動 → 工場労働 → 大量生産、となります。";
    if (prompt.includes("問題"))
      return "確認問題：蒸気機関の普及によって、工場の立地はどのように変化したでしょうか？";
    return `「${prompt}」について、このページでは複数の条件が結びつく因果関係に注目してください。特に資源を実際の生産へ変える制度が重要です。`;
  },
  async summarize() {
    await wait(500);
    return "産業革命は、資源・市場・金融・技術が相互に作用して生まれ、工場・交通・都市のあり方を変えた。";
  },
  async expandContent() {
    await wait(500);
    return "背景には農業生産性の向上、植民地交易、特許制度、熟練職人のネットワークもありました。";
  },
  async simplifyContent() {
    return this.askQuestion("もっと簡単に");
  },
  async generateDiagram() {
    return this.askQuestion("図で説明");
  },
  async generateQuiz() {
    return this.askQuestion("問題を作る");
  },
  async generateFlashcards() {
    return "カードを3枚作成しました。復習セットへ追加されています。";
  },
};
