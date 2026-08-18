import "server-only";
import type { McpScope } from "./scopes";
import {
  MCP_KNOWLEDGE_READ,
  MCP_COURSES_READ,
  MCP_STUDENTS_READ,
  MCP_APPOINTMENTS_READ,
  MCP_CRM_WRITE,
  MCP_APPOINTMENTS_WRITE,
} from "./scopes";

/**
 * Explicit MCP tool allowlist. Only these ANEI tools are ever exposed over
 * MCP. Every entry is mapped to a scope and a risk level; the ToolRegistry
 * authorize() remains the authoritative enforcement layer for user sessions.
 *
 * - READ / LOW_RISK_WRITE: executed directly against the registry.
 * - BUSINESS_WRITE (create_appointment): propose-only. The MCP client can only
 *   create a confirmation; the action never executes over MCP. The proposal is
 *   recorded and the human user confirms through the first-party UI.
 *
 * enroll_student is deliberately absent: it is a BUSINESS_WRITE that must be
 * confirmed by a human in the first-party experience, not delegated to MCP.
 * assign_teacher (SENSITIVE) is deferred to a future phase requiring explicit
 * human approval.
 */
export interface McpToolEntry {
  /** Name exposed to MCP clients (equal to the ANEI tool name). */
  name: string;
  description: string;
  scope: McpScope;
  riskLevel: "READ" | "LOW_RISK_WRITE" | "BUSINESS_WRITE";
  /** REQUIRED_MCP_SCOPE gate for service credentials. */
  requiredScope: McpScope;
  /** Which actor types may see/call this tool over MCP. */
  actors: readonly ["user"] | readonly ["user", "service"];
}

export const MCP_TOOLS: readonly McpToolEntry[] = [
  {
    name: "search_knowledge",
    description: "Search the inclusive-education knowledge base available to the caller.",
    scope: MCP_KNOWLEDGE_READ,
    riskLevel: "READ",
    requiredScope: MCP_KNOWLEDGE_READ,
    actors: ["user", "service"],
  },
  {
    name: "get_my_courses",
    description: "List courses available to the caller.",
    scope: MCP_COURSES_READ,
    riskLevel: "READ",
    requiredScope: MCP_COURSES_READ,
    actors: ["user", "service"],
  },
  {
    name: "get_my_enrollments",
    description: "List the caller's own course enrollments.",
    scope: MCP_STUDENTS_READ,
    riskLevel: "READ",
    requiredScope: MCP_STUDENTS_READ,
    actors: ["user", "service"],
  },
  {
    name: "get_course_details",
    description: "Get details for a course the caller can access.",
    scope: MCP_COURSES_READ,
    riskLevel: "READ",
    requiredScope: MCP_COURSES_READ,
    actors: ["user", "service"],
  },
  {
    name: "get_student_progress",
    description: "Get progress for a student the caller is authorized to view.",
    scope: MCP_STUDENTS_READ,
    riskLevel: "READ",
    requiredScope: MCP_STUDENTS_READ,
    actors: ["user", "service"],
  },
  {
    name: "get_cohort_information",
    description: "Get information about a cohort the caller belongs to or manages.",
    scope: MCP_STUDENTS_READ,
    riskLevel: "READ",
    requiredScope: MCP_STUDENTS_READ,
    actors: ["user", "service"],
  },
  {
    name: "list_my_appointments",
    description: "List the caller's appointments.",
    scope: MCP_APPOINTMENTS_READ,
    riskLevel: "READ",
    requiredScope: MCP_APPOINTMENTS_READ,
    actors: ["user", "service"],
  },
  {
    name: "create_crm_note",
    description: "Append a note to a CRM contact. The note author is always the server actor, never client-supplied.",
    scope: MCP_CRM_WRITE,
    riskLevel: "LOW_RISK_WRITE",
    requiredScope: MCP_CRM_WRITE,
    actors: ["user"],
  },
  {
    name: "add_crm_tag",
    description: "Attach a tag to a CRM contact.",
    scope: MCP_CRM_WRITE,
    riskLevel: "LOW_RISK_WRITE",
    requiredScope: MCP_CRM_WRITE,
    actors: ["user"],
  },
  {
    name: "create_appointment",
    description: "Propose a new appointment. MCP clients can only create a confirmation request; the action is never executed over MCP.",
    scope: MCP_APPOINTMENTS_WRITE,
    riskLevel: "BUSINESS_WRITE",
    requiredScope: MCP_APPOINTMENTS_WRITE,
    actors: ["user"],
  },
];

export const MCP_TOOL_MAP = new Map(MCP_TOOLS.map((entry) => [entry.name, entry]));

/**
 * MCP resources exposed. User-scoped; the profile of the authenticated caller.
 */
export const MCP_RESOURCE_PROFILE = "anei://profile/me";

export const MCP_RESOURCES = [{ uri: MCP_RESOURCE_PROFILE, name: "My profile" }] as const;
