import type { GenerationResult } from "./types.js";

interface OpenAIOutputContent {
  type?: string;
  text?: string;
}

interface OpenAIOutputItem {
  type?: string;
  content?: OpenAIOutputContent[];
}

interface OpenAIResponse {
  id?: string;
  output_text?: string;
  output?: OpenAIOutputItem[];
  usage?: Record<string, unknown>;
  service_tier?: string;
}

export function outputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text ?? "")
    .join("");
}

export async function structuredGeneration<T>(options: {
  apiKey: string;
  model: string;
  prompt: string;
  name: string;
  schema: object;
  useWebSearch?: boolean;
}): Promise<GenerationResult<T>> {
  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      ...(options.useWebSearch === false
        ? {}
        : { tools: [{ type: "web_search" }] }),
      input: options.prompt,
      text: {
        format: {
          type: "json_schema",
          name: options.name,
          strict: true,
          schema: options.schema,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`openai_${response.status}`);

  const json = (await response.json()) as OpenAIResponse;
  const text = outputText(json);
  if (!text) throw new Error("empty_model_output");
  return {
    data: JSON.parse(text) as T,
    meta: {
      responseId: json.id ?? "",
      durationMs: Date.now() - startedAt,
      usage: json.usage ?? {},
      serviceTier: json.service_tier ?? "",
      webSearchCalls: (json.output ?? []).filter(
        (item) => item.type === "web_search_call",
      ).length,
    },
  };
}
