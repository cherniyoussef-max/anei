export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  riskLevel: "read" | "write" | "sensitive";
  aneiToolName: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPContext {
  userId: string;
  organizationId?: string;
  locale: "fr" | "ar";
  requestId: string;
}

export class MCPRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();

  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  registerResource(resource: MCPResource): void {
    this.resources.set(resource.uri, resource);
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getResource(uri: string): MCPResource | undefined {
    return this.resources.get(uri);
  }

  getAllResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  async mapToANEITool(mcpToolName: string, input: unknown, context: MCPContext): Promise<unknown> {
    const mcpTool = this.tools.get(mcpToolName);
    if (!mcpTool) {
      throw new Error(`MCP tool not found: ${mcpToolName}`);
    }

    const { getToolRegistry } = await import("@/server/tools/registry");
    const toolRegistry = getToolRegistry();

    const proposal = await toolRegistry.proposeTool(
      mcpTool.aneiToolName,
      {
        userId: context.userId,
        locale: context.locale,
        requestId: context.requestId,
        organizationId: context.organizationId,
      },
      input,
      ""
    );

    if (proposal.requiresConfirmation) {
      throw new Error(`CONFIRMATION_REQUIRED:${proposal.executionId}`);
    }

    return { success: true };
  }
}

export const mcpRegistry = new MCPRegistry();

function registerCoreMCPTools(): void {
  mcpRegistry.registerTool({
    name: "search_knowledge",
    description: "Search the ANEI knowledge base for relevant information",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 500 },
        courseId: { type: "string", format: "uuid" },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["query"],
    },
    riskLevel: "read",
    aneiToolName: "search_knowledge",
  });

  mcpRegistry.registerTool({
    name: "get_my_courses",
    description: "Get the current user's enrolled courses",
    inputSchema: { type: "object", properties: {} },
    riskLevel: "read",
    aneiToolName: "get_my_courses",
  });

  mcpRegistry.registerTool({
    name: "list_my_appointments",
    description: "List the current user's appointments",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      },
    },
    riskLevel: "read",
    aneiToolName: "list_my_appointments",
  });

  mcpRegistry.registerTool({
    name: "get_course_details",
    description: "Get detailed information about a specific course",
    inputSchema: {
      type: "object",
      properties: { courseId: { type: "string", format: "uuid" } },
      required: ["courseId"],
    },
    riskLevel: "read",
    aneiToolName: "get_course_details",
  });
}

registerCoreMCPTools();