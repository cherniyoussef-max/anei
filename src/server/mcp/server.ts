import "server-only";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MCP_TOOLS, MCP_RESOURCES } from "./allowlist";
import { assertScope, type McpActor } from "./auth";
import { getToolDefinition, buildToolContext } from "@/server/tools/registry";
import { executeReadTool, executeLowRiskWriteTool, authorizeAndPropose } from "@/server/tools/execution";
import { db } from "@/server/db";
import { aiConversation } from "@/server/db/schema";
import type { ToolContext } from "@/server/tools/types";

const MCP_CONVERSATION_TITLE = "MCP";

/**
 * ToolContext for an MCP actor.
 *
 * - user: standard registry context (org membership + persona resolved from DB).
 * - service: org context comes from the credential. A write scope on the
 *   credential is a delegation made by an OWNER/MANAGER at creation time, so it
 *   maps to STAFF-grade organization role; without a write scope the service
 *   remains role-less (reads only, and only what read tools permit).
 */
export async function buildMcpToolContext(actor: McpActor, requestId: string): Promise<ToolContext> {
  if (actor.actorType === "user") {
    const context = await buildToolContext({ userId: actor.userId, locale: actor.locale, requestId });
    if (!context.organizationId && actor.organizationId) {
      context.organizationId = actor.organizationId;
    }
    if (!context.organizationRole && actor.organizationRole) {
      context.organizationRole = actor.organizationRole;
    }
    return context;
  }

  const hasWriteScope =
    actor.scopes.includes("anei:crm:write") || actor.scopes.includes("anei:appointments:write");

  return {
    userId: actor.userId,
    locale: actor.locale,
    requestId,
    organizationId: actor.organizationId,
    platformRole: "USER",
    organizationRole: hasWriteScope ? "STAFF" : undefined,
  };
}

interface McpSession {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
}

const mcpInstances: Partial<Record<"user" | "service", McpSession>> = {};

function toolResponseText(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

/**
 * ai_tool_execution.conversation_id is a NOT NULL FK to ai_conversation. MCP
 * proposals have no chat conversation, so each actor reuses a dedicated MCP
 * conversation row owned by that actor (created on demand). Proposals surface
 * as pending actions for the actor and are confirmable through the first-party
 * experience.
 */
async function getOrCreateMcpConversation(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: aiConversation.id })
    .from(aiConversation)
    .where(and(eq(aiConversation.userId, userId), eq(aiConversation.title, MCP_CONVERSATION_TITLE), eq(aiConversation.status, "ACTIVE")))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(aiConversation)
    .values({ userId, title: MCP_CONVERSATION_TITLE })
    .returning({ id: aiConversation.id });
  return created.id;
}

function registerTools(server: McpServer, actorType: "user" | "service") {
  for (const entry of MCP_TOOLS) {
    if (!entry.actors.some((actor) => actor === actorType)) continue;

    const toolDef = getToolDefinition(entry.name);
    if (!toolDef) continue;

    const handler = async (args: unknown, extra: { authInfo?: { extra?: Record<string, unknown> } }) => {
      const actor = (extra.authInfo?.extra?.aneiActor as McpActor | undefined);
      if (!actor) {
        return toolResponseText("Unauthorized: missing actor", true);
      }
      if (!assertScope(actor, entry.requiredScope)) {
        return toolResponseText("Forbidden: missing required scope", true);
      }

      const requestId = crypto.randomUUID();
      const toolContext = await buildMcpToolContext(actor, requestId);

      try {
        if (entry.riskLevel === "READ") {
          const result = await executeReadTool(toolDef, toolContext, args);
          if (!result.success) {
            return toolResponseText(result.error ?? "Tool failed", true);
          }
          return toolResponseText(JSON.stringify(result.data));
        }

        if (entry.riskLevel === "LOW_RISK_WRITE") {
          const result = await executeLowRiskWriteTool(toolDef, toolContext, args);
          if (!result.success) {
            return toolResponseText(result.error ?? "Tool failed", true);
          }
          return toolResponseText(JSON.stringify(result.data));
        }

        // BUSINESS_WRITE via MCP is propose-only: the human must confirm in the
        // first-party UI. The MCP client never executes these actions.
        const conversationId = await getOrCreateMcpConversation(actor.userId);
        const proposal = await authorizeAndPropose(toolDef, toolContext, args, conversationId);
        return toolResponseText(
          JSON.stringify({
            confirmationRequired: proposal.requiresConfirmation,
            executionId: proposal.executionId,
            preview: proposal.preview,
            note: "This action is not executed over MCP. Confirm it in the ANEI application.",
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        return toolResponseText(message, true);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).tool(entry.name, entry.description, (toolDef.inputSchema as any).shape, handler);
  }
}

function registerResources(server: McpServer) {
  for (const resource of MCP_RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      { mimeType: "application/json", description: "Profile of the authenticated MCP caller" },
      async (_uri, extra) => {
        const actor = (extra.authInfo?.extra?.aneiActor as McpActor | undefined);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: "application/json",
              text: JSON.stringify({ profile: actor?.userId ?? "unknown" }),
            },
          ],
        };
      },
    );
  }
}

/**
 * Singleton MCP server over the web-standards Streamable HTTP transport. The
 * single transport instance processes every request (stateful JSON-RPC
 * sessions via sessionIdGenerator); per-request actor authentication is
 * threaded through handleRequest options -> authInfo -> tool handlers.
 */
export async function getMcpHandler(): Promise<
  (request: Request, options?: { actor?: McpActor; actorType?: "user" | "service" }) => Promise<Response>
> {
  return async (request, options) => {
    const actorType = options?.actorType ?? options?.actor?.actorType ?? "user";
    let mcpInstance = mcpInstances[actorType] ?? null;

    if (!mcpInstance) {
    const server = new McpServer(
      { name: "anei-mcp", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {} } },
    );
      registerTools(server, actorType);
    registerResources(server);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
    });
    await server.connect(transport);
      mcpInstance = { server, transport };
      mcpInstances[actorType] = mcpInstance;
    }

    const { transport } = mcpInstance;
    const actor = options?.actor;
    return transport.handleRequest(request, {
      authInfo: actor
        ? {
          token: actor.actorType === "service" ? `service:${actor.credentialId}` : "session",
          clientId: actor.userId,
          scopes: actor.scopes,
          extra: { aneiActor: actor },
        }
        : undefined,
    });
  };
}

/** Test hook: rebuild the singleton with a fresh transport (resets sessions). */
export function resetMcpServer(): void {
  delete mcpInstances.user;
  delete mcpInstances.service;
}
