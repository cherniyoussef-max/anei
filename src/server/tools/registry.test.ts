import type { ToolRegistry, AiToolContext, AiTool } from "@/server/ai/contracts";
import type { ToolDefinition, ToolContext } from "./types";
import { z } from "zod";
import crypto from "node:crypto";

const _TestInputSchema = z.object({});
const _TestOutputSchema = z.object({});

export class TestToolRegistry implements ToolRegistry {
  private tools: Map<string, (input: unknown, context: AiToolContext) => Promise<unknown>> = new Map();
  private toolDefs: Map<string, ToolDefinition<typeof _TestInputSchema, typeof _TestOutputSchema>> = new Map();

  registerTool(def: ToolDefinition<typeof _TestInputSchema, typeof _TestOutputSchema>, impl: (context: ToolContext, input: unknown) => Promise<unknown>): void {
    this.toolDefs.set(def.name, def);
    this.tools.set(def.name, async (input: unknown, context: AiToolContext) => {
      const toolContext: ToolContext = {
        userId: context.userId,
        locale: context.locale,
        requestId: context.requestId,
        organizationId: context.organizationId,
        platformRole: "USER",
      };
      return impl(toolContext, input);
    });
  }

  async getAllowedTools(_context: AiToolContext): Promise<AiTool[]> {
    const allowed: AiTool[] = [];
    for (const [name, execute] of this.tools) {
      const def = this.toolDefs.get(name);
      if (!def) continue;
      if (def.riskLevel === "SENSITIVE") continue;
      allowed.push({ name, description: def.description, execute });
    }
    return allowed;
  }

  async proposeTool(
    toolName: string,
    aiContext: AiToolContext,
    input: unknown,
    _conversationId: string
  ): Promise<{ executionId: string; requiresConfirmation: boolean; preview: Record<string, unknown> }> {
    const def = this.toolDefs.get(toolName);
    if (!def) throw new Error(`Unknown tool: ${toolName}`);

    const execute = this.tools.get(toolName);
    if (!execute) throw new Error(`Tool not implemented: ${toolName}`);

    const inputHash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16);
    return {
      executionId: `test-exec-${inputHash}`,
      requiresConfirmation: def.riskLevel === "BUSINESS_WRITE" || def.riskLevel === "SENSITIVE",
      preview: input as Record<string, unknown>,
    };
  }

  async confirmAndExecuteTool(
    toolName: string,
    aiContext: AiToolContext,
    executionId: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const execute = this.tools.get(toolName);
    if (!execute) throw new Error(`Tool not implemented: ${toolName}`);
    try {
      const result = await execute(input, aiContext);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async rejectTool(_aiContext: AiToolContext, _executionId: string): Promise<void> {
    // No-op for test
  }
}
