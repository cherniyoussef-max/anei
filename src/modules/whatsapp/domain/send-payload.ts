export type WhatsAppSendPayload = {
  organizationId: string;
  contactId: string;
  templateId: string;
  language: string;
  parameters?: string[];
};

export type WhatsAppSendPayloadResult =
  | { ok: true; payload: WhatsAppSendPayload }
  | { ok: false; reason: "INVALID_TEMPLATE" };

/**
 * Builds the admin send-request payload the WhatsApp send route requires.
 *
 * The route contract (src/app/api/admin/crm/whatsapp/send/route.ts) demands a
 * non-optional `language`. The language is never free-form user input: it is
 * derived from the currently selected local template. If no valid selected
 * template/language exists, the caller must fail safely instead of sending an
 * invalid request.
 */
export function buildWhatsAppSendPayload(input: {
  organizationId: string;
  contactId: string;
  templateId: string;
  templateLanguage: string | undefined;
  parameters?: string[];
}): WhatsAppSendPayloadResult {
  if (!input.templateLanguage) return { ok: false, reason: "INVALID_TEMPLATE" };
  const payload: WhatsAppSendPayload = {
    organizationId: input.organizationId,
    contactId: input.contactId,
    templateId: input.templateId,
    language: input.templateLanguage,
  };
  if (input.parameters && input.parameters.length > 0) payload.parameters = input.parameters;
  return { ok: true, payload };
}