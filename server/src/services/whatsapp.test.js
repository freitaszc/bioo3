import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { decryptToken, encryptToken, verifyWebhookSignature } from "./whatsapp.js";

test("encrypts WhatsApp tokens without storing plaintext", () => {
  const previous = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = "test-key-with-more-than-thirty-two-characters";
  try {
    const encrypted = encryptToken("secret-access-token");
    assert.notEqual(encrypted, "secret-access-token");
    assert.equal(decryptToken(encrypted), "secret-access-token");
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    else process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = previous;
  }
});

test("verifies Meta webhook signatures", () => {
  const previous = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = "meta-test-secret";
  try {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex")}`;
    assert.equal(verifyWebhookSignature(body, signature), true);
    assert.equal(verifyWebhookSignature(body, "sha256=invalid"), false);
  } finally {
    if (previous === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = previous;
  }
});
