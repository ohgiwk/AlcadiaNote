import assert from "node:assert/strict";
import test from "node:test";
import { outputText, structuredGeneration } from "./openai.js";

test("reads the Responses API output_text shortcut", () => {
  assert.equal(outputText({ output_text: "answer" }), "answer");
});

test("joins output_text content items and ignores tool calls", () => {
  assert.equal(
    outputText({
      output: [
        { type: "web_search_call" },
        {
          type: "message",
          content: [
            { type: "output_text", text: "first" },
            { type: "refusal", text: "ignored" },
            { type: "output_text", text: " second" },
          ],
        },
      ],
    }),
    "first second",
  );
});

test("structured generation rejects unsuccessful API responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("rate limited", { status: 429 }));
  await assert.rejects(
    structuredGeneration({
      apiKey: "secret",
      model: "model",
      prompt: "prompt",
      name: "result",
      schema: {},
    }),
    /openai_429/,
  );
});

test("structured generation rejects empty and invalid JSON output", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch");
  fetchMock.mock.mockImplementationOnce(async () =>
    Response.json({ output_text: "" }),
  );
  await assert.rejects(
    structuredGeneration({
      apiKey: "secret",
      model: "model",
      prompt: "prompt",
      name: "result",
      schema: {},
    }),
    /empty_model_output/,
  );
  fetchMock.mock.mockImplementationOnce(async () =>
    Response.json({ output_text: "not-json" }),
  );
  await assert.rejects(
    structuredGeneration({
      apiKey: "secret",
      model: "model",
      prompt: "prompt",
      name: "result",
      schema: {},
    }),
    SyntaxError,
  );
});

test("structured generation sends schema options and reports metadata", async (t) => {
  let request: RequestInit | undefined;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    request = init;
    return Response.json({
      id: "response-1",
      output_text: '{"answer":42}',
      output: [{ type: "web_search_call" }],
      usage: { input_tokens: 10 },
      service_tier: "default",
    });
    },
  );
  const result = await structuredGeneration<{ answer: number }>({
    apiKey: "secret",
    model: "model",
    prompt: "prompt",
    name: "result",
    schema: { type: "object" },
    useWebSearch: false,
  });
  const body = JSON.parse(String(request?.body));
  assert.equal(request?.method, "POST");
  assert.equal(body.tools, undefined);
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(result.data, { answer: 42 });
  assert.equal(result.meta.responseId, "response-1");
  assert.equal(result.meta.webSearchCalls, 1);
});
