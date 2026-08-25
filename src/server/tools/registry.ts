import type { ToolRegistry, AiToolContext, AiTool } from "@/server/ai/contracts";
import type { AnyToolDefinition } from "./types";
import { z } from "zod";
import {
  searchKnowledgeTool,
  getMyCoursesTool,
  listMyAppointmentsTool,
  getCourseDetailsTool,
} from "./definitions/read-tools";
import {
  createAppointmentTool,
  rescheduleAppointmentTool,
  sendWhatsAppTemplateTool,
} from "./definitions/business-tools";
import {
  getMyEnrollmentsTool,
  getStudentProgressTool,
  getCohortInformationTool,
} from "./definitions/read-expansion";
import { createCrmNoteTool, addCrmTagTool } from "./definitions/low-risk-tools";
import { enrollStudentTool } from "./definitions/business-expansion";
import { authorizeAndPropose, executeReadTool, executeLowRiskWriteTool, confirmAndExecute, rejectExecution } from "./execution";
import { db } from "@/server/db";
import { organizationMembership, personaMembership } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

const ALL_TOOLS: AnyToolDefinition[] = [
  searchKnowledgeTool,
  getMyCoursesTool,
  listMyAppointmentsTool,
  getCourseDetailsTool,
  getMyEnrollmentsTool,
  getStudentProgressTool,
  getCohortInformationTool,
  createCrmNoteTool,
  addCrmTagTool,
  createAppointmentTool,
  rescheduleAppointmentTool,
  sendWhatsAppTemplateTool,
  enrollStudentTool,
];

const TOOL_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export function getToolDefinition(name: string): AnyToolDefinition | undefined {
  return TOOL_MAP.get(name);
}

export function getAllToolDefinitions(): AnyToolDefinition[] {
  return [...ALL_TOOLS];
}

function mapPlatformRole(role: string): "USER" | "ADMIN" | "SUPER_ADMIN" {
  if (role === "ADMIN") return "ADMIN";
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  return "USER";
}

function mapOrganizationRole(role: string | null): "OWNER" | "MANAGER" | "STAFF" | "VIEWER" | undefined {
  if (!role) return undefined;
  if (["OWNER", "MANAGER", "STAFF", "VIEWER"].includes(role)) {
    return role as "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
  }
  return undefined;
}

export async function buildToolContext(aiContext: AiToolContext): Promise<{
  userId: string;
  locale: "fr" | "ar";
  requestId: string;
  organizationId?: string | null;
  platformRole: "USER" | "ADMIN" | "SUPER_ADMIN";
  activePersona?: string;
  organizationRole?: "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
}> {
  let organizationId: string | null = null;
  let organizationRole: "OWNER" | "MANAGER" | "STAFF" | "VIEWER" | undefined;

  if (aiContext.organizationId) {
    organizationId = aiContext.organizationId;
  }

  if (organizationId) {
    const [membership] = await db
      .select({ role: organizationMembership.role })
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.organizationId, organizationId),
          eq(organizationMembership.userId, aiContext.userId),
          eq(organizationMembership.status, "ACTIVE")
        )
      )
      .limit(1);
    organizationRole = mapOrganizationRole(membership?.role ?? null);
  }

  const [persona] = await db
    .select({ persona: personaMembership.persona })
    .from(personaMembership)
    .where(
      and(
        eq(personaMembership.userId, aiContext.userId),
        eq(personaMembership.status, "ACTIVE"),
        eq(personaMembership.isPrimary, true)
      )
    )
    .limit(1);
  const activePersona = persona?.persona;

  return {
    userId: aiContext.userId,
    locale: aiContext.locale,
    requestId: aiContext.requestId,
    organizationId,
    platformRole: mapPlatformRole("USER"),
    activePersona,
    organizationRole,
  };
}

export class ControlledToolRegistry implements ToolRegistry {
  async getAllowedTools(context: AiToolContext): Promise<AiTool[]> {
    const toolContext = await buildToolContext(context);
    const allowedTools: AiTool[] = [];

    for (const toolDef of ALL_TOOLS) {
      if (toolDef.riskLevel === "SENSITIVE") continue;

      if (toolDef.canList) {
        const capability = await toolDef.canList(toolContext);
        if (!capability.allowed) continue;
      } else {
        // No context-only capability gate: try authorizing against an empty
        // input. Tools with required input fields cannot be parsed here — the
        // parse fails and the tool is listed, with the hard authorization
        // enforced at execution time by `authorize`.
        const parsed = toolDef.inputSchema.safeParse({});
        if (parsed.success) {
          const authResult = await toolDef.authorize(toolContext, parsed.data);
          if (!authResult.allowed) continue;
        }
      }

      allowedTools.push({
          name: toolDef.name,
          description: toolDef.description,
          riskLevel: toolDef.riskLevel,
          inputSchema: z.toJSONSchema(toolDef.inputSchema) as Record<string, unknown>,
          execute: async (input: unknown) => {
            if (toolDef.riskLevel === "READ") {
              const result = await executeReadTool(toolDef, toolContext, input);
              if (!result.success) throw new Error(result.error);
              return result.data;
            }
            if (toolDef.riskLevel === "LOW_RISK_WRITE") {
              const result = await executeLowRiskWriteTool(toolDef, toolContext, input);
              if (!result.success) throw new Error(result.error);
              return result.data;
            }
            const proposal = await authorizeAndPropose(toolDef, toolContext, input, "", []);
            if (proposal.requiresConfirmation) {
              throw new Error(`CONFIRMATION_REQUIRED:${proposal.executionId}`);
            }
            return { success: true };
          },
        });
    }

    return allowedTools;
  }

  async proposeTool(
    toolName: string,
    aiContext: AiToolContext,
    input: unknown,
    conversationId: string
  ): Promise<{ executionId: string; requiresConfirmation: boolean; preview: Record<string, unknown> }> {
    const toolDef = getToolDefinition(toolName);
    if (!toolDef) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const toolContext = await buildToolContext(aiContext);
    const authResult = await toolDef.authorize(toolContext, toolDef.inputSchema.parse(input));
    if (!authResult.allowed) {
      throw new Error(`Authorization failed: ${authResult.reason}`);
    }

    const previewKeys = toolDef.inputSchema instanceof z.ZodObject
      ? Object.keys(toolDef.inputSchema.shape)
      : [];
    return authorizeAndPropose(toolDef, toolContext, input, conversationId, previewKeys);
  }

  async confirmAndExecuteTool(
    toolName: string,
    aiContext: AiToolContext,
    executionId: string,
    input: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const toolDef = getToolDefinition(toolName);
    if (!toolDef) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const toolContext = await buildToolContext(aiContext);
    return confirmAndExecute(toolDef, toolContext, executionId, input);
  }

  async rejectTool(aiContext: AiToolContext, executionId: string): Promise<void> {
    await rejectExecution(executionId, aiContext.userId);
  }
}

let toolRegistryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ControlledToolRegistry();
  }
  return toolRegistryInstance;
}

export function setToolRegistry(registry: ToolRegistry): void {
  toolRegistryInstance = registry;
}
