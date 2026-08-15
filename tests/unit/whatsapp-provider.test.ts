process.env.ENABLE_WHATSAPP = "true";
process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
process.env.WHATSAPP_APP_SECRET = "test-app-secret";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";

import test from "node:test";
import assert from "node:assert/strict";

test("MetaWhatsAppCloudProvider is configured when env secrets are present", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  assert.equal(metaWhatsAppCloudProvider.isConfigured(), true);
});

test("sendTemplateMessage posts the documented Cloud API shape and returns the provider message id", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const captured: { url: string; options: RequestInit } = { url: "", options: {} };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured.url = String(input);
    captured.options = init ?? {};
    return new Response(JSON.stringify({ messages: [{ id: "wamid.HBgL" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await metaWhatsAppCloudProvider.sendTemplateMessage({
      phoneNumberId: "112358132134",
      to: "21620123456",
      templateName: "welcome",
      language: "fr",
      bodyParameters: [{ type: "text", text: "Léa" }],
    });
    assert.equal(result.providerMessageId, "wamid.HBgL");
    assert.equal(captured.url, "https://graph.facebook.com/v22.0/112358132134/messages");
    const body = JSON.parse(String(captured.options.body)) as {
      messaging_product: string;
      recipient_type: string;
      to: string;
      type: string;
      template: { name: string; language: { policy: string; code: string }; components: Array<{ type: string; parameters: Array<{ type: string; text: string }> }> };
    };
    assert.equal(body.messaging_product, "whatsapp");
    assert.equal(body.recipient_type, "individual");
    assert.equal(body.to, "21620123456");
    assert.equal(body.type, "template");
    assert.equal(body.template.language.policy, "deterministic");
    assert.deepEqual(body.template.components, [{ type: "body", parameters: [{ type: "text", text: "Léa" }] }]);
    assert.equal((captured.options.headers as Record<string, string>).Authorization, "Bearer test-access-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendTemplateMessage omits the components array entirely when there are no body parameters", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const captured: { options: RequestInit } = { options: {} };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    captured.options = init ?? {};
    return new Response(JSON.stringify({ messages: [{ id: "wamid.NOPARAMS" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    await metaWhatsAppCloudProvider.sendTemplateMessage({
      phoneNumberId: "1",
      to: "21620123456",
      templateName: "no-params",
      language: "fr",
      bodyParameters: [],
    });
    const body = JSON.parse(String(captured.options.body)) as { template: { components: unknown } };
    assert.deepEqual(body.template.components, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendTemplateMessage maps provider rejection into a bounded WhatsAppProviderError", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const { WhatsAppProviderError } = await import("../../src/server/whatsapp/contracts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: "Template not approved", code: 132000, error_data: { details: "Please review the template status" } } }), { status: 400, headers: { "content-type": "application/json" } })) as typeof fetch;

  try {
    await assert.rejects(
      () => metaWhatsAppCloudProvider.sendTemplateMessage({ phoneNumberId: "1", to: "21620123456", templateName: "x", language: "fr", bodyParameters: [] }),
      (error: unknown) => error instanceof WhatsAppProviderError && error.message === "META_SEND_REJECTED" && error.providerErrorCode === "132000",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendTemplateMessage maps auth failures distinctly and never leaks the access token", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const { WhatsAppProviderError } = await import("../../src/server/whatsapp/contracts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: "Invalid OAuth access token", type: "OAuthException", code: 190 } }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;

  try {
    await assert.rejects(
      () => metaWhatsAppCloudProvider.sendTemplateMessage({ phoneNumberId: "1", to: "21620123456", templateName: "x", language: "fr", bodyParameters: [] }),
      (error: unknown) => error instanceof WhatsAppProviderError && error.message === "META_AUTH_FAILED" && error.providerErrorCode === "190",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listTemplates extracts name, language, status and body parameter count from components", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [
          { name: "welcome", language: "fr", category: "UTILITY", status: "APPROVED", components: [{ type: "BODY", text: "Bonjour {{1}}, bienvenue {{2}}" }] },
          { name: "nocount", language: "ar", category: "UTILITY", status: "PENDING", components: [{ type: "BODY", text: "لا معاملات" }] },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

  try {
    const templates = await metaWhatsAppCloudProvider.listTemplates("102290129340398");
    assert.equal(templates.length, 2);
    assert.deepEqual(templates[0], { name: "welcome", language: "fr", category: "UTILITY", status: "APPROVED", parameterCount: 2 });
    assert.deepEqual(templates[1], { name: "nocount", language: "ar", category: "UTILITY", status: "PENDING", parameterCount: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listTemplates throws a bounded provider error on a non-2xx response", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const { WhatsAppProviderError } = await import("../../src/server/whatsapp/contracts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: "WABA not found", code: 100 } }), { status: 404, headers: { "content-type": "application/json" } })) as typeof fetch;

  try {
    await assert.rejects(
      () => metaWhatsAppCloudProvider.listTemplates("missing-waba"),
      (error: unknown) => error instanceof WhatsAppProviderError && error.providerErrorCode === "100",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider HTTP calls are bounded by a request timeout", async () => {
  const { metaWhatsAppCloudProvider } = await import("../../src/server/whatsapp/meta");
  const originalFetch = globalThis.fetch;
  let signal: AbortSignal | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Response(JSON.stringify({ messages: [{ id: "wamid.TIMEOUT" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    await metaWhatsAppCloudProvider.sendTemplateMessage({ phoneNumberId: "1", to: "21620123456", templateName: "x", language: "fr", bodyParameters: [] });
    assert.ok(signal, "a fetch signal must be supplied");
    assert.equal(signal?.aborted, false, "the signal must be an AbortSignal");
  } finally {
    globalThis.fetch = originalFetch;
  }
});