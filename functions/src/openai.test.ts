import assert from "node:assert/strict";
import test from "node:test";
import { outputText } from "./openai.js";

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
