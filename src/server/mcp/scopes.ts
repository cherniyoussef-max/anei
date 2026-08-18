import "server-only";

/**
 * MCP tool scopes. These gate what an MCP client (service credential) may
 * reach through the MCP server. User browser sessions are not gated by scopes —
 * their access is enforced by the ToolRegistry authorize() at execution time.
 * Scopes are a necessary-not-sufficient layer; they never grant anything the
 * underlying tool authorization would deny.
 */
export const MCP_KNOWLEDGE_READ = "anei:knowledge:read";
export const MCP_COURSES_READ = "anei:courses:read";
export const MCP_STUDENTS_READ = "anei:students:read";
export const MCP_APPOINTMENTS_READ = "anei:appointments:read";
export const MCP_CRM_WRITE = "anei:crm:write";
export const MCP_APPOINTMENTS_WRITE = "anei:appointments:write";

export const ALL_MCP_SCOPES = [
  MCP_KNOWLEDGE_READ,
  MCP_COURSES_READ,
  MCP_STUDENTS_READ,
  MCP_APPOINTMENTS_READ,
  MCP_CRM_WRITE,
  MCP_APPOINTMENTS_WRITE,
] as const;

export type McpScope = (typeof ALL_MCP_SCOPES)[number];

/**
 * Scopes for the n8n -> ANEI internal automation API. These are distinct from
 * MCP tool scopes: they authorize the out-of-band service endpoints that
 * automations call, never end-user tooling.
 */
export const AUTOMATION_KNOWLEDGE_INGEST = "automation:knowledge:ingest";
export const AUTOMATION_APPOINTMENTS_READ = "automation:appointments:read";
export const AUTOMATION_ONBOARDING_READ = "automation:onboarding:read";
export const AUTOMATION_NOTIFICATIONS_REQUEST = "automation:notifications:request";
export const AUTOMATION_EXECUTIONS_UPDATE = "automation:executions:update";

export const ALL_AUTOMATION_SCOPES = [
  AUTOMATION_KNOWLEDGE_INGEST,
  AUTOMATION_APPOINTMENTS_READ,
  AUTOMATION_ONBOARDING_READ,
  AUTOMATION_NOTIFICATIONS_REQUEST,
  AUTOMATION_EXECUTIONS_UPDATE,
] as const;

export type AutomationScope = (typeof ALL_AUTOMATION_SCOPES)[number];
