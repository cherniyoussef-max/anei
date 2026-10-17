import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { normalizeWebhook } from "../../src/server/whatsapp/normalize";

test("normalizeWebhook extracts referral and ctwa_clid from Meta Ads click-to-WhatsApp message", () => {
  const metaAdsPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_123456",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+21620000000",
                phone_number_id: "PHONE_ID_999",
              },
              contacts: [
                {
                  profile: { name: "Fatma Ben Salem" },
                  wa_id: "21698765432",
                },
              ],
              messages: [
                {
                  from: "21698765432",
                  id: "wamid.HBgLMjE2OTg3NjU0MzIVAgASGBQz",
                  timestamp: "1729166400",
                  type: "text",
                  text: {
                    body: "Bonjour, je souhaite m'inscrire à la formation AVS.",
                  },
                  referral: {
                    source_type: "ad",
                    source_id: "6543210987654",
                    source_url: "https://fb.me/anei_avs_ad",
                    headline: "Devenez Accompagnant Scolaire (AVS) Certifié",
                    body: "Session certifiante ANEI — Automne 2026. Inscrivez-vous !",
                    media_type: "image",
                    image_url: "https://scontent.whatsapp.net/ad_creative.jpg",
                    ctwa_clid: "CTWA_CLID_ABCD_1234567890",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const events = normalizeWebhook(metaAdsPayload);
  assert.equal(events.length, 1);

  const event = events[0];
  assert.equal(event.kind, "inbound_message");
  if (event.kind === "inbound_message") {
    assert.equal(event.senderWaId, "21698765432");
    assert.equal(event.textPreview, "Bonjour, je souhaite m'inscrire à la formation AVS.");
    assert.ok(event.referral);
    assert.equal(event.referral.source_type, "ad");
    assert.equal(event.referral.source_id, "6543210987654");
    assert.equal(event.referral.headline, "Devenez Accompagnant Scolaire (AVS) Certifié");
    assert.equal(event.referral.ctwa_clid, "CTWA_CLID_ABCD_1234567890");
  }
});

test("Meta webhook HMAC-SHA256 signature verification validates authentic payloads", () => {
  const secret = "meta_app_secret_super_secure_key_123";
  const body = JSON.stringify({ object: "page", entry: [{ id: "123" }] });

  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const validHeader = `sha256=${hmac}`;

  // Signature verification logic
  function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
    const receivedHash = signatureHeader.slice(7);
    const expectedHash = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(receivedHash, "hex"), Buffer.from(expectedHash, "hex"));
    } catch {
      return false;
    }
  }

  assert.equal(verifyMetaSignature(body, validHeader, secret), true);
  assert.equal(verifyMetaSignature(body, "sha256=invalid_hash_value_here", secret), false);
  assert.equal(verifyMetaSignature(body, null, secret), false);
  assert.equal(verifyMetaSignature("tampered body", validHeader, secret), false);
});
