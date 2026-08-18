import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types";
import { addCrmContactNote, attachCrmContactTag } from "@/server/services/crm";

// -----------------------------------------------------------------------------
// create_crm_note — LOW_RISK_WRITE. Author always comes from the server actor
// (context.userId); the note is written only inside the actor's organization.
// -----------------------------------------------------------------------------
const CreateCrmNoteInput = z.object({
  contactId: z.string().uuid(),
  body: z.string().min(1).max(2000),
}).strict();
type CreateCrmNoteInput = z.infer<typeof CreateCrmNoteInput>;

const CreateCrmNoteOutput = z.object({
  noteId: z.string(),
});
type CreateCrmNoteOutput = z.infer<typeof CreateCrmNoteOutput>;

export const createCrmNoteTool: ToolDefinition<typeof CreateCrmNoteInput, typeof CreateCrmNoteOutput> = {
  name: "create_crm_note",
  description: "Add a note to a CRM contact within the current organization. Requires STAFF+ organization role.",
  riskLevel: "LOW_RISK_WRITE",
  inputSchema: CreateCrmNoteInput,
  outputSchema: CreateCrmNoteOutput,
  requiresConfirmation: false,
  canList: async (context: ToolContext) => {
    if (!context.organizationId || !context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false };
    }
    return { allowed: true };
  },
  authorize: async (context: ToolContext) => {
    if (!context.organizationId) {
      return { allowed: false, reason: "No organization context" };
    }
    if (!context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false, reason: "Insufficient organization role" };
    }
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: CreateCrmNoteInput) => {
    const result = await addCrmContactNote(context.userId, context.organizationId!, input.contactId, input.body);
    if (result.kind !== "ok") {
      throw new Error(`Failed to add CRM note: ${result.kind}`);
    }
    return { noteId: result.id };
  },
};

// -----------------------------------------------------------------------------
// add_crm_tag — LOW_RISK_WRITE. Attaches an existing org-scoped tag to an
// org-scoped contact; both lookups are validated by the existing CRM service.
// -----------------------------------------------------------------------------
const AddCrmTagInput = z
  .object({
    contactId: z.string().uuid(),
    tagId: z.string().uuid(),
  })
  .strict();
type AddCrmTagInput = z.infer<typeof AddCrmTagInput>;

const AddCrmTagOutput = z.object({
  contactId: z.string(),
});
type AddCrmTagOutput = z.infer<typeof AddCrmTagOutput>;

export const addCrmTagTool: ToolDefinition<typeof AddCrmTagInput, typeof AddCrmTagOutput> = {
  name: "add_crm_tag",
  description: "Attach an existing organization-scoped tag to a CRM contact within the current organization. Requires STAFF+ organization role.",
  riskLevel: "LOW_RISK_WRITE",
  inputSchema: AddCrmTagInput,
  outputSchema: AddCrmTagOutput,
  requiresConfirmation: false,
  canList: async (context: ToolContext) => {
    if (!context.organizationId || !context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false };
    }
    return { allowed: true };
  },
  authorize: async (context: ToolContext) => {
    if (!context.organizationId) {
      return { allowed: false, reason: "No organization context" };
    }
    if (!context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false, reason: "Insufficient organization role" };
    }
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: AddCrmTagInput) => {
    const result = await attachCrmContactTag(context.userId, context.organizationId!, input.contactId, input.tagId);
    if (result.kind !== "ok") {
      throw new Error(`Failed to attach CRM tag: ${result.kind}`);
    }
    return { contactId: input.contactId };
  },
};