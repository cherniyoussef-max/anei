import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../types";
import { createAppointment, rescheduleAppointment } from "@/server/services/appointments";
import { sendWhatsAppTemplate } from "@/server/services/whatsapp";
import type { OrganizationRole } from "@/modules/relationships/domain/permissions";
import type { AppointmentType } from "@/modules/admission/domain/permissions";

const CreateAppointmentInput = z.object({
  contactId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),
  type: z.enum(["ASSESSMENT", "INFO_MEETING", "FOLLOW_UP", "OTHER"]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  note: z.string().max(1000).optional(),
});
type CreateAppointmentInput = z.infer<typeof CreateAppointmentInput>;

const CreateAppointmentOutput = z.object({
  appointmentId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
});
type CreateAppointmentOutput = z.infer<typeof CreateAppointmentOutput>;

export const createAppointmentTool: ToolDefinition<typeof CreateAppointmentInput, typeof CreateAppointmentOutput> = {
  name: "create_appointment",
  description: "Create a new appointment for a CRM contact. Requires STAFF+ organization role.",
  riskLevel: "BUSINESS_WRITE",
  inputSchema: CreateAppointmentInput,
  outputSchema: CreateAppointmentOutput,
  requiresConfirmation: true,
  authorize: async (context: ToolContext, _input: CreateAppointmentInput) => {
    if (!context.organizationId) {
      return { allowed: false, reason: "No organization context" };
    }
    if (!context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false, reason: "Insufficient organization role" };
    }
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: CreateAppointmentInput) => {
    const result = await createAppointment(
      context.userId,
      context.organizationRole as OrganizationRole,
      context.organizationId!,
      {
        contactId: input.contactId,
        assignedToUserId: input.assignedToUserId,
        type: input.type as AppointmentType,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        note: input.note,
      }
    );
    if (result.kind !== "ok") {
      throw new Error(`Failed to create appointment: ${result.kind}`);
    }
    const { getAppointment } = await import("@/server/queries/admission");
    const appointmentData = await getAppointment(context.organizationId!, result.id);
    return {
      appointmentId: result.id,
      startAt: appointmentData!.appointment.startAt.toISOString(),
      endAt: appointmentData!.appointment.endAt.toISOString(),
    };
  },
};

const RescheduleAppointmentInput = z.object({
  appointmentId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentInput>;

const RescheduleAppointmentOutput = z.object({
  appointmentId: z.string(),
  newStartAt: z.string(),
  newEndAt: z.string(),
});
type RescheduleAppointmentOutput = z.infer<typeof RescheduleAppointmentOutput>;

export const rescheduleAppointmentTool: ToolDefinition<typeof RescheduleAppointmentInput, typeof RescheduleAppointmentOutput> = {
  name: "reschedule_appointment",
  description: "Reschedule an existing appointment. Requires STAFF+ organization role.",
  riskLevel: "BUSINESS_WRITE",
  inputSchema: RescheduleAppointmentInput,
  outputSchema: RescheduleAppointmentOutput,
  requiresConfirmation: true,
  authorize: async (context: ToolContext, _input: RescheduleAppointmentInput) => {
    if (!context.organizationId) {
      return { allowed: false, reason: "No organization context" };
    }
    if (!context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false, reason: "Insufficient organization role" };
    }
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: RescheduleAppointmentInput) => {
    const result = await rescheduleAppointment(
      context.userId,
      context.organizationRole as OrganizationRole,
      context.organizationId!,
      input.appointmentId,
      new Date(input.startAt),
      new Date(input.endAt)
    );
    if (result.kind !== "ok") {
      throw new Error(`Failed to reschedule appointment: ${result.kind}`);
    }
    const { getAppointment } = await import("@/server/queries/admission");
    const appointmentData = await getAppointment(context.organizationId!, result.id);
    return {
      appointmentId: result.id,
      newStartAt: appointmentData!.appointment.startAt.toISOString(),
      newEndAt: appointmentData!.appointment.endAt.toISOString(),
    };
  },
};

const SendWhatsAppTemplateInput = z.object({
  contactId: z.string().uuid(),
  templateId: z.string().uuid(),
  language: z.string().min(2).max(10),
  parameters: z.array(z.string().max(4096)).max(32).optional(),
});
type SendWhatsAppTemplateInput = z.infer<typeof SendWhatsAppTemplateInput>;

const SendWhatsAppTemplateOutput = z.object({
  messageId: z.string(),
  status: z.string(),
});
type SendWhatsAppTemplateOutput = z.infer<typeof SendWhatsAppTemplateOutput>;

export const sendWhatsAppTemplateTool: ToolDefinition<typeof SendWhatsAppTemplateInput, typeof SendWhatsAppTemplateOutput> = {
  name: "send_whatsapp_template",
  description: "Send a WhatsApp template message to a CRM contact. Requires STAFF+ organization role.",
  riskLevel: "BUSINESS_WRITE",
  inputSchema: SendWhatsAppTemplateInput,
  outputSchema: SendWhatsAppTemplateOutput,
  requiresConfirmation: true,
  authorize: async (context: ToolContext, _input: SendWhatsAppTemplateInput) => {
    if (!context.organizationId) {
      return { allowed: false, reason: "No organization context" };
    }
    if (!context.organizationRole || !["OWNER", "MANAGER", "STAFF"].includes(context.organizationRole)) {
      return { allowed: false, reason: "Insufficient organization role" };
    }
    return { allowed: true };
  },
  execute: async (context: ToolContext, input: SendWhatsAppTemplateInput) => {
    const result = await sendWhatsAppTemplate(
      context.userId,
      context.organizationRole as OrganizationRole,
      context.organizationId!,
      {
        contactId: input.contactId,
        templateId: input.templateId,
        language: input.language,
        parameters: input.parameters,
      }
    );
    if (result.kind !== "ok") {
      throw new Error(`Failed to send WhatsApp message: ${result.kind}`);
    }
    return {
      messageId: result.id,
      status: "QUEUED",
    };
  },
};