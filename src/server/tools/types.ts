import { z } from "zod";

export type ToolRiskLevel = "READ" | "LOW_RISK_WRITE" | "BUSINESS_WRITE" | "SENSITIVE";

export interface ToolContext {
  userId: string;
  locale: "fr" | "ar";
  requestId: string;
  organizationId?: string | null;
  platformRole: "USER" | "ADMIN" | "SUPER_ADMIN";
  activePersona?: string;
  organizationRole?: "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
}

export interface ToolDefinition<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  inputSchema: TInput;
  outputSchema: TOutput;
  requiresConfirmation: boolean;
  authorize: (context: ToolContext, input: z.infer<TInput>) => Promise<{ allowed: boolean; reason?: string }>;
  execute: (context: ToolContext, input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
  /**
   * Optional context-only capability check used when listing available tools,
   * before any concrete input exists (input schemas with required fields
   * cannot be authorized at list time). When absent, the tool is listed and
   * authorization is enforced at execution time by `authorize`.
   */
  canList?: (context: ToolContext) => Promise<{ allowed: boolean }>;
}

export type AnyToolDefinition = ToolDefinition<z.ZodType, z.ZodType>;

export interface ToolCall {
  name: string;
  arguments: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionId?: string;
  requiresConfirmation?: boolean;
  confirmationSummary?: string;
}

export interface ToolExecutionRecord {
  id: string;
  conversationId: string;
  userId: string;
  toolName: string;
  riskLevel: ToolRiskLevel;
  inputHash: string;
  safeInputPreview: Record<string, unknown>;
  status: "PROPOSED" | "CONFIRMED" | "EXECUTED" | "REJECTED" | "FAILED" | "EXPIRED";
  requestedAt: Date;
  confirmedAt?: Date;
  executedAt?: Date;
  resultCode?: string;
  errorMessage?: string;
}