import {
  whatsappAccessToken,
  whatsappApiBaseUrl,
  whatsappApiVersion,
  whatsappConfigured,
} from "@/server/whatsapp/config";
import {
  WhatsAppNotConfiguredError,
  WhatsAppProviderError,
  type ProviderTemplate,
  type SendTemplateInput,
  type SendTemplateResult,
  type SendTextInput,
  type SendTextResult,
  type WhatsAppProvider,
} from "@/server/whatsapp/contracts";

/**
 * Official Meta WhatsApp Cloud API adapter. One deployment-level access token
 * serves every organization; per-organization identity is carried by the
 * phone number id / waba id from the org's whatsapp_account row (never
 * client-supplied). Errors are mapped to bounded domain errors — raw provider
 * error objects (which can contain the request config/authorization header)
 * are never returned to callers or logged.
 */

type SendResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string; type?: string; code?: number; error_data?: { details?: string } };
  [key: string]: unknown;
};

type TemplatesResponse = {
  data?: Array<{
    name?: string;
    language?: string;
    category?: string;
    status?: string;
    components?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string; code?: number };
  [key: string]: unknown;
};

function authorizationHeader() {
  if (!whatsappAccessToken) throw new WhatsAppNotConfiguredError();
  return `Bearer ${whatsappAccessToken}`;
}

/** Counts `{{n}}` body variables in the template's body component text. */
function countBodyParameters(components: Array<{ type?: string; text?: string }> | undefined): number {
  const body = components?.find((component) => component.type === "BODY");
  if (!body?.text) return 0;
  const matches = body.text.match(/\{\{\d+\}\}/g);
  if (!matches) return 0;
  return matches.reduce((max, placeholder) => {
    const index = Number(placeholder.replace(/[^0-9]/g, ""));
    return Number.isFinite(index) ? Math.max(max, index) : max;
  }, 0);
}

function mapSendError(response: Response, payload: SendResponse): WhatsAppProviderError {
  const code = payload.error?.code ?? null;
  const details = payload.error?.error_data?.details ?? payload.error?.message ?? null;
  const bounded = details ? details.slice(0, 500) : null;
  if (response.status === 401 || response.status === 403) {
    return new WhatsAppProviderError("META_AUTH_FAILED", "auth_failed", code != null ? String(code) : null, bounded);
  }
  if (payload.error?.message) {
    return new WhatsAppProviderError("META_SEND_REJECTED", "provider_rejected", code != null ? String(code) : null, bounded);
  }
  return new WhatsAppProviderError(`META_UNEXPECTED_RESPONSE (${response.status})`, "unexpected", code != null ? String(code) : null, null);
}

export const metaWhatsAppCloudProvider: WhatsAppProvider = {
  name: "meta",
  isConfigured: () => whatsappConfigured,

  async sendTemplateMessage(input: SendTemplateInput): Promise<SendTemplateResult> {
    if (!whatsappConfigured) throw new WhatsAppNotConfiguredError();
    const url = `${whatsappApiBaseUrl}/${whatsappApiVersion}/${encodeURIComponent(input.phoneNumberId)}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { policy: "deterministic", code: input.language },
          components: input.bodyParameters.length
            ? [{ type: "body", parameters: input.bodyParameters }]
            : [],
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    let payload: SendResponse = {};
    try {
      payload = (await response.json()) as SendResponse;
    } catch {
      throw new WhatsAppProviderError(`META_INVALID_RESPONSE (${response.status})`, "invalid_response");
    }

    const providerMessageId = payload.messages?.[0]?.id;
    if (!response.ok || !providerMessageId) {
      throw mapSendError(response, payload);
    }
    return { providerMessageId };
  },

  async sendTextMessage(input: SendTextInput): Promise<SendTextResult> {
    if (!whatsappConfigured) throw new WhatsAppNotConfiguredError();
    const url = `${whatsappApiBaseUrl}/${whatsappApiVersion}/${encodeURIComponent(input.phoneNumberId)}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { preview_url: false, body: input.body },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    let payload: SendResponse = {};
    try {
      payload = (await response.json()) as SendResponse;
    } catch {
      throw new WhatsAppProviderError(`META_INVALID_RESPONSE (${response.status})`, "invalid_response");
    }

    const providerMessageId = payload.messages?.[0]?.id;
    if (!response.ok || !providerMessageId) {
      throw mapSendError(response, payload);
    }
    return { providerMessageId };
  },

  async listTemplates(wabaId: string): Promise<ProviderTemplate[]> {
    if (!whatsappConfigured) throw new WhatsAppNotConfiguredError();
    const url = `${whatsappApiBaseUrl}/${whatsappApiVersion}/${encodeURIComponent(wabaId)}/message_templates`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: authorizationHeader() },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    let payload: TemplatesResponse = {};
    try {
      payload = (await response.json()) as TemplatesResponse;
    } catch {
      throw new WhatsAppProviderError(`META_INVALID_RESPONSE (${response.status})`, "invalid_response");
    }

    if (!response.ok || !Array.isArray(payload.data)) {
      const code = payload.error?.code ?? null;
      throw new WhatsAppProviderError(
        `META_TEMPLATES_FETCH_FAILED (${response.status})`,
        "templates_fetch_failed",
        code != null ? String(code) : null,
        payload.error?.message ? payload.error.message.slice(0, 500) : null,
      );
    }

    return payload.data.flatMap((template) => {
      const name = template.name?.trim();
      const language = template.language?.trim();
      if (!name || !language) return [];
      return [
        {
          name,
          language,
          category: (template.category ?? "UNKNOWN").slice(0, 64),
          status: (template.status ?? "PENDING").toUpperCase().slice(0, 64),
          parameterCount: countBodyParameters(template.components),
        },
      ];
    });
  },
};