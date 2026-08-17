export interface AutomationWorkflow {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  riskLevel: "read" | "write" | "sensitive";
  aneiToolName?: string;
}

export interface N8NClient {
  triggerWorkflow(workflowName: string, input: Record<string, unknown>, context: {
    userId: string;
    organizationId?: string;
    locale: "fr" | "ar";
    requestId: string;
  }): Promise<{ success: boolean; executionId?: string; error?: string }>;
  getWorkflowStatus(executionId: string): Promise<{ status: "running" | "completed" | "failed" | "unknown"; output?: unknown }>;
}

export interface AutomationRegistry {
  workflows: Map<string, AutomationWorkflow>;
  getWorkflow(name: string): AutomationWorkflow | undefined;
  getAllWorkflows(): AutomationWorkflow[];
  registerWorkflow(workflow: AutomationWorkflow): void;
}

export const automationRegistry: AutomationRegistry = {
  workflows: new Map(),

  getWorkflow(name: string) {
    return this.workflows.get(name);
  },

  getAllWorkflows() {
    return Array.from(this.workflows.values());
  },

  registerWorkflow(workflow: AutomationWorkflow) {
    this.workflows.set(workflow.name, workflow);
  },
};

export class N8NAutomationClient implements N8NClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async triggerWorkflow(workflowName: string, input: Record<string, unknown>, context: {
    userId: string;
    organizationId?: string;
    locale: "fr" | "ar";
    requestId: string;
  }): Promise<{ success: boolean; executionId?: string; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${this.baseUrl}/webhook/${workflowName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-ANEI-User-ID": context.userId,
          "X-ANEI-Org-ID": context.organizationId ?? "",
          "X-ANEI-Locale": context.locale,
          "X-ANEI-Request-ID": context.requestId,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const result = await response.json();
      return { success: true, executionId: result.executionId };
    } catch (error) {
      clearTimeout(timeoutId);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getWorkflowStatus(_executionId: string): Promise<{ status: "running" | "completed" | "failed" | "unknown"; output?: unknown }> {
    return { status: "unknown" };
  }
}

let n8nClientInstance: N8NClient | null = null;

export function getN8NClient(): N8NClient | null {
  return n8nClientInstance;
}

export function setN8NClient(client: N8NClient): void {
  n8nClientInstance = client;
}