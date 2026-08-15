import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWhatsAppSendPayload } from "../../src/modules/whatsapp/domain/send-payload";

const SEND_ROUTE = "src/app/api/admin/crm/whatsapp/send/route.ts";
const ACCOUNT_ROUTE = "src/app/api/admin/crm/whatsapp/account/route.ts";
const TEMPLATES_ROUTE = "src/app/api/admin/crm/whatsapp/templates/route.ts";
const MESSAGES_ROUTE = "src/app/api/admin/crm/whatsapp/messages/route.ts";

test("whatsapp send route: untrusted origin, admin auth, and rate limit all gate the mutation", async () => {
  const source = await readFile(SEND_ROUTE, "utf8");
  const originIndex = source.indexOf("isTrustedMutation(request)");
  const sessionIndex = source.indexOf("getAdminSessionFor(\"crm.manage\")");
  const rateIndex = source.indexOf("adminMutationRateLimit(session.user.id)");
  const readIndex = source.indexOf("readLimitedJson(request)");
  assert.ok(originIndex > -1 && sessionIndex > -1 && rateIndex > -1 && readIndex > -1);
  assert.ok(originIndex < sessionIndex, "origin check must run before auth");
  assert.ok(sessionIndex < rateIndex, "auth must run before rate limiting");
  assert.ok(rateIndex < readIndex, "rate limit must run before reading the body");
});

test("whatsapp send route: body is validated with a strict bounded Zod schema", async () => {
  const source = await readFile(SEND_ROUTE, "utf8");
  assert.equal(source.includes(".strict()"), true);
  assert.equal(source.includes("z.string().uuid()"), true);
  assert.equal(source.includes("MAX_PARAMETERS"), true);
  assert.equal(source.includes("MAX_PARAMETER_TEXT"), true);
  assert.equal(source.includes("sendSchema.safeParse"), true);
});

test("whatsapp send route: language stays a required non-optional field in the schema", async () => {
  const source = await readFile(SEND_ROUTE, "utf8");
  // language must remain required so callers cannot bypass template-driven language.
  assert.equal(/language: z\.string\(\)\.trim\(\)\.min\(2\)\.max\(16\)[,)]/.test(source), true);
  assert.equal(/language: z\.string\(\)\s*\.optional\(\)/.test(source), false);
});

test("whatsapp send form: request payload carries the selected template's language", () => {
  const orgId = "5f8b9c9e-6b1a-4d2e-9a3f-000000000001";
  const contactId = "5f8b9c9e-6b1a-4d2e-9a3f-000000000002";
  const built = buildWhatsAppSendPayload({
    organizationId: orgId,
    contactId,
    templateId: "tmpl_fr",
    templateLanguage: "fr",
    parameters: ["Bonjour"],
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.deepEqual(built.payload, {
    organizationId: orgId,
    contactId,
    templateId: "tmpl_fr",
    language: "fr",
    parameters: ["Bonjour"],
  });
});

test("whatsapp send form: language follows the currently selected template", () => {
  const orgId = "5f8b9c9e-6b1a-4d2e-9a3f-000000000001";
  const contactId = "5f8b9c9e-6b1a-4d2e-9a3f-000000000002";
  const arBuilt = buildWhatsAppSendPayload({
    organizationId: orgId,
    contactId,
    templateId: "tmpl_ar",
    templateLanguage: "ar",
  });
  assert.equal(arBuilt.ok, true);
  if (arBuilt.ok) assert.equal(arBuilt.payload.language, "ar");
  const frBuilt = buildWhatsAppSendPayload({
    organizationId: orgId,
    contactId,
    templateId: "tmpl_fr",
    templateLanguage: "fr",
  });
  assert.equal(frBuilt.ok, true);
  if (frBuilt.ok) assert.equal(frBuilt.payload.language, "fr");
});

test("whatsapp send form: fails safely when no valid template language is selected", () => {
  const orgId = "5f8b9c9e-6b1a-4d2e-9a3f-000000000001";
  const contactId = "5f8b9c9e-6b1a-4d2e-9a3f-000000000002";
  const built = buildWhatsAppSendPayload({
    organizationId: orgId,
    contactId,
    templateId: "tmpl_missing",
    templateLanguage: undefined,
  });
  assert.deepEqual(built, { ok: false, reason: "INVALID_TEMPLATE" });
});

test("whatsapp send form: the form derives the payload from the selected template via the shared builder", async () => {
  const source = await readFile("src/components/admin/AdminWhatsAppSendForm.tsx", "utf8");
  assert.equal(source.includes("buildWhatsAppSendPayload"), true);
  const payloadIndex = source.indexOf("body: JSON.stringify(built.payload)");
  const templateLanguageIndex = source.indexOf("templateLanguage: selectedTemplate?.language");
  assert.ok(payloadIndex > -1, "form must submit the builder payload");
  assert.ok(templateLanguageIndex > -1, "form must derive language from the selected template");
  assert.ok(templateLanguageIndex < payloadIndex, "language must be derived before the request is built");
});

test("whatsapp send route: org-role gate is resolved server-side and applied by the service", async () => {
  const source = await readFile(SEND_ROUTE, "utf8");
  const roleIndex = source.indexOf("resolveActorOrgRole(session.user.id, organizationId)");
  const sendIndex = source.indexOf("sendWhatsAppTemplate(session.user.id, actorRole, organizationId, data)");
  assert.ok(roleIndex > -1 && sendIndex > -1);
  assert.ok(roleIndex < sendIndex);
  assert.equal(source.includes("result.kind === \"forbidden\""), true);
});

test("whatsapp account route: config writes require MANAGER-equivalent org role and never accept secrets", async () => {
  const source = await readFile(ACCOUNT_ROUTE, "utf8");
  assert.equal(source.includes("getAdminSessionFor(\"crm.manage\")"), true);
  assert.equal(source.includes("resolveActorOrgRole"), true);
  assert.equal(source.includes("upsertWhatsAppAccount"), true);
  // The account model stores provider metadata only — never tokens/secrets.
  assert.equal(/accessToken|appSecret|verifyToken/i.test(source), false);
});

test("whatsapp templates route: sync is a MANAGER-gated POST that maps provider errors distinctly", async () => {
  const source = await readFile(TEMPLATES_ROUTE, "utf8");
  assert.equal(source.includes("getAdminSessionFor(\"crm.manage\")"), true);
  assert.equal(source.includes("syncWhatsAppTemplates"), true);
  assert.equal(source.includes("PROVIDER_ERROR"), true);
  assert.equal(source.includes("NO_ACCOUNT"), true);
  assert.equal(source.includes("NOT_CONFIGURED"), true);
});

test("whatsapp messages route: reads require crm.read and filters/sort are allowlisted", async () => {
  const source = await readFile(MESSAGES_ROUTE, "utf8");
  assert.equal(source.includes("getAdminSessionFor(\"crm.read\")"), true);
  assert.equal(source.includes("z.enum([\"INBOUND\", \"OUTBOUND\"])"), true);
  assert.equal(source.includes("z.enum([\"QUEUED\", \"SENT\", \"DELIVERED\", \"READ\", \"FAILED\"])"), true);
  assert.equal(source.includes("z.enum([\"createdAt\", \"sentAt\", \"deliveredAt\", \"readAt\", \"failedAt\"])"), true);
});