export type AiRole = "system" | "user" | "assistant" | "tool";
export type AiMessage = { role: AiRole; content: string; metadata?: Record<string, unknown> };
export type AiLocale = "fr" | "ar";

export type ChatInput = {
  userId: string;
  locale: AiLocale;
  messages: AiMessage[];
  courseId?: string;
  requestId?: string;
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
};

export type ChatOutput = {
  text: string;
  toolCalls?: Array<{ id?: string; name: string; arguments: unknown }>;
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
    organizationId?: string | null;
    courseId?: string;
    limit?: number;
  }): Promise<RetrievalResult[]>;
}

export interface ConversationRepository {
  append(input: { conversationId: string; userId: string; message: AiMessage }): Promise<void>;
  list(input: { conversationId: string; userId: string; limit?: number }): Promise<AiMessage[]>;
  createConversation(userId: string, organizationId?: string | null, title?: string): Promise<string>;
  getConversation(conversationId: string, userId: string): Promise<{ id: string; userId: string; organizationId: string | null; title: string | null; status: string } | undefined>;
}

export type AiToolContext = { userId: string; locale: AiLocale; requestId: string; organizationId?: string | null };
export type AiTool = {
  name: string;
  description: string;
  riskLevel?: "READ" | "LOW_RISK_WRITE" | "BUSINESS_WRITE" | "SENSITIVE";
  inputSchema?: Record<string, unknown>;
  execute(input: unknown, context: AiToolContext): Promise<unknown>;
};

/** The registry is an allowlist. Every tool must authorize independently of the LLM. */
export interface ToolRegistry {
  getAllowedTools(context: AiToolContext): Promise<AiTool[]>;
  proposeTool(
    toolName: string,
    context: AiToolContext,
    input: unknown,
    conversationId: string
  ): Promise<{ executionId: string; requiresConfirmation: boolean; preview: Record<string, unknown> }>;
  confirmAndExecuteTool(
    toolName: string,
    context: AiToolContext,
    executionId: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }>;
  rejectTool(context: AiToolContext, executionId: string): Promise<void>;
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
