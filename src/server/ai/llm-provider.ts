import "server-only";
import { env } from "@/server/env";
import type { LLMProvider, ChatInput, ChatOutput } from "./contracts";

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  choices: Array<{
    message: OpenAIChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function parseStructuredToolCalls(message: OpenAIChatMessage): ChatOutput["toolCalls"] {
  if (!message.tool_calls) return undefined;
  return message.tool_calls.flatMap((call) => {
    try {
      const args = JSON.parse(call.function.arguments) as unknown;
      if (!args || typeof args !== "object" || Array.isArray(args)) return [];
      return [{ id: call.id, name: call.function.name, arguments: args }];
    } catch {
      return [];
    }
  });
}

const MAX_INPUT_TOKENS = 128_000;
const MAX_OUTPUT_TOKENS = 4_096;

function buildOpenAIMessages(input: ChatInput): OpenAIChatMessage[] {
  const messages: OpenAIChatMessage[] = [];
  for (const msg of input.messages) {
    if (msg.role === "system" || msg.role === "user" || msg.role === "assistant") {
      const structuredCalls = msg.role === "assistant" && Array.isArray(msg.metadata?.toolCalls)
        ? msg.metadata.toolCalls as OpenAIChatMessage["tool_calls"]
        : undefined;
      messages.push({ role: msg.role, content: msg.content, tool_calls: structuredCalls });
    } else if (msg.role === "tool") {
      const toolCallId = typeof msg.metadata?.toolCallId === "string" ? msg.metadata.toolCallId : "compatibility-call";
      messages.push({ role: "tool", content: msg.content, tool_call_id: toolCallId });
    }
  }
  return messages;
}

export class OpenAILLMProvider implements LLMProvider {
  readonly name = "openai";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey ?? env.OPENAI_API_KEY ?? "";
    this.baseUrl = config?.baseUrl ?? env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1";
    this.model = config?.model ?? env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const messages = buildOpenAIMessages(input);
    const estimatedInputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    if (estimatedInputTokens > MAX_INPUT_TOKENS) {
      throw new Error(`Input exceeds token limit: ${estimatedInputTokens} > ${MAX_INPUT_TOKENS}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          tools: input.tools?.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema,
              strict: true,
            },
          })),
          tool_choice: input.tools?.length ? "auto" : undefined,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const choice = data.choices[0];
      if (!choice) {
        throw new Error("No response from OpenAI");
      }

      return {
        text: choice.message.content ?? "",
        toolCalls: parseStructuredToolCalls(choice.message),
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          estimatedCostMinor: Math.round((data.usage.prompt_tokens * 0.15 + data.usage.completion_tokens * 0.6) / 1000),
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("OpenAI request timeout");
      }
      throw error;
    }
  }
}

export class TestLLMProvider implements LLMProvider {
  readonly name = "test";
  private responses: Map<string, ChatOutput> = new Map();
  private defaultResponse: ChatOutput = {
    text: "Test response",
    usage: { inputTokens: 10, outputTokens: 20 },
  };

  setResponse(key: string, response: ChatOutput): void {
    this.responses.set(key, response);
  }

  setDefaultResponse(response: ChatOutput): void {
    this.defaultResponse = response;
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    const key = input.requestId ?? input.messages.map((m) => m.content).join("|");
    return this.responses.get(key) ?? this.defaultResponse;
  }
}

let llmProviderInstance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!llmProviderInstance) {
    if (env.NODE_ENV === "test" || !env.OPENAI_API_KEY) {
      llmProviderInstance = new TestLLMProvider();
    } else {
      llmProviderInstance = new OpenAILLMProvider();
    }
  }
  return llmProviderInstance;
}

export function setLLMProvider(provider: LLMProvider): void {
  llmProviderInstance = provider;
}
