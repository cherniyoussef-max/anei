export type AiRole = "system" | "user" | "assistant";
export type AiMessage = { role: AiRole; content: string };
export type AiLocale = "fr" | "ar";

export type ChatInput = {
  userId: string;
  locale: AiLocale;
  messages: AiMessage[];
  courseId?: string;
  requestId?: string;
};

export type ChatOutput = {
  text: string;
  citations?: Array<{ label: string; href?: string; sourceId?: string }>;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostMinor?: number };
};

/** Provider boundary: LMS/domain code must never import a vendor SDK directly. */
export interface LLMProvider {
  readonly name: string;
  chat(input: ChatInput): Promise<ChatOutput>;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export type RetrievalResult = {
  id: string;
  text: string;
  score: number;
  source: string;
  courseId?: string;
  resourceId?: string;
};

/** Implementations MUST apply user entitlement filters before returning private chunks. */
export interface Retriever {
  search(input: {
    query: string;
    locale: AiLocale;
    userId: string;
    courseId?: string;
    limit?: number;
  }): Promise<RetrievalResult[]>;
}

export interface ConversationRepository {
  append(input: { conversationId: string; userId: string; message: AiMessage }): Promise<void>;
  list(input: { conversationId: string; userId: string; limit?: number }): Promise<AiMessage[]>;
}

export type AiToolContext = { userId: string; locale: AiLocale; requestId: string };
export type AiTool = {
  name: string;
  description: string;
  execute(input: unknown, context: AiToolContext): Promise<unknown>;
};

/** The registry is an allowlist. Every tool must authorize independently of the LLM. */
export interface ToolRegistry {
  getAllowedTools(context: AiToolContext): Promise<AiTool[]>;
}

export interface AIUsageMeter {
  assertWithinQuota(input: { userId: string; estimatedInputTokens: number }): Promise<void>;
  record(input: {
    userId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    success: boolean;
  }): Promise<void>;
}

// Backward-compatible aliases for the first prototype boundary.
export type AiProvider = LLMProvider;
export type KnowledgeRetriever = Retriever;
