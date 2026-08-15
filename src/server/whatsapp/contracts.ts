// WhatsApp provider boundary. Domain/service code must never import a vendor
// SDK or issue raw Meta HTTP calls directly — everything goes through
// WhatsAppProvider. The abstraction exists for testability, secret isolation
// and provider-specific HTTP encapsulation, NOT to build a universal
// omnichannel messaging framework: there is exactly one provider today
// (MetaWhatsAppCloudProvider in meta.ts).

export const whatsappProviderNames = ["meta"] as const;
export type WhatsAppProviderName = (typeof whatsappProviderNames)[number];

/** A bounded, validated template body parameter (never arbitrary nested Meta JSON). */
export type TemplateBodyParameter = {
  type: "text";
  text: string;
};

export type SendTemplateInput = {
  /** Organization-scoped provider account (phone number id) — resolved server-side, never client-supplied. */
  phoneNumberId: string;
  /** Destination wa_id in digits-only canonical form. */
  to: string;
  templateName: string;
  /** Meta language code (e.g. `fr`, `ar`). */
  language: string;
  bodyParameters: TemplateBodyParameter[];
};

export type SendTemplateResult = {
  providerMessageId: string;
};

/** Template catalog entry returned by the provider's message-templates fetch. */
export type ProviderTemplate = {
  name: string;
  language: string;
  category: string;
  status: string;
  /** Number of `{{n}}` body variables — used to bound send parameters. */
  parameterCount: number;
};

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  isConfigured(): boolean;
  sendTemplateMessage(input: SendTemplateInput): Promise<SendTemplateResult>;
  listTemplates(wabaId: string): Promise<ProviderTemplate[]>;
}

export class WhatsAppProviderError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly providerErrorCode?: string | null,
    readonly providerErrorMessage?: string | null,
  ) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}

/** Thrown when the deployment has no configured Meta credential. */
export class WhatsAppNotConfiguredError extends Error {
  constructor() {
    super("WHATSAPP_NOT_CONFIGURED");
    this.name = "WhatsAppNotConfiguredError";
  }
}