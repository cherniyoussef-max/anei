import test from "node:test";
import assert from "node:assert/strict";
import { OpenAILLMProvider } from "@/server/ai/llm-provider";

test("OpenAI adapter sends strict function schemas and returns structured arguments", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      choices: [{
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{
            id: "call-1",
            type: "function",
            function: { name: "get_course_details", arguments: '{"courseId":"course-1"}' },
          }],
        },
      }],
      usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new OpenAILLMProvider({ apiKey: "test-key", baseUrl: "https://provider.example/v1" });
    const output = await provider.chat({
      userId: "user-1",
      locale: "fr",
      messages: [{ role: "user", content: "Ouvre mon cours" }],
      tools: [{
        name: "get_course_details",
        description: "Get a course",
        inputSchema: {
          type: "object",
          properties: { courseId: { type: "string" } },
          required: ["courseId"],
          additionalProperties: false,
        },
      }],
    });

    const tools = requestBody?.tools as Array<{ function: { strict: boolean } }>;
    assert.equal(tools[0].function.strict, true);
    assert.deepEqual(output.toolCalls, [{ id: "call-1", name: "get_course_details", arguments: { courseId: "course-1" } }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI adapter discards malformed structured arguments instead of text-executing them", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: 'TOOL_CALL {"name":"unsafe","arguments":{}}',
        tool_calls: [{ id: "call-bad", type: "function", function: { name: "get_course_details", arguments: "not-json" } }],
      },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const provider = new OpenAILLMProvider({ apiKey: "test-key", baseUrl: "https://provider.example/v1" });
    const output = await provider.chat({
      userId: "user-1",
      locale: "fr",
      messages: [{ role: "user", content: "test" }],
      tools: [{ name: "get_course_details", description: "Get a course", inputSchema: { type: "object" } }],
    });
    assert.deepEqual(output.toolCalls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI adapter preserves assistant call ids on subsequent tool-result turns", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: { messages?: Array<Record<string, unknown>> } | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as { messages?: Array<Record<string, unknown>> };
    return new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Terminé" } }],
      usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new OpenAILLMProvider({ apiKey: "test-key", baseUrl: "https://provider.example/v1" });
    await provider.chat({
      userId: "user-1",
      locale: "fr",
      messages: [
        { role: "user", content: "Mon cours" },
        {
          role: "assistant",
          content: "",
          metadata: {
            toolCalls: [{
              id: "call-course",
              type: "function",
              function: { name: "get_course_details", arguments: '{"courseId":"course-1"}' },
            }],
          },
        },
        { role: "tool", content: '{"title":"Cours"}', metadata: { toolCallId: "call-course" } },
      ],
    });
    assert.equal(requestBody?.messages?.[1].tool_calls && (requestBody.messages[1].tool_calls as Array<{ id: string }>)[0].id, "call-course");
    assert.equal(requestBody?.messages?.[2].tool_call_id, "call-course");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
