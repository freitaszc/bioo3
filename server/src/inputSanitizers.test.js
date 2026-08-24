import assert from "node:assert/strict";
import test from "node:test";
import { councilType, digitsOnly, normalizeWhatsAppPhone, uppercaseText, validPhone, validWhatsAppPhone } from "./inputSanitizers.js";

test("sanitizes prescriber and patient inputs", () => {
  assert.equal(uppercaseText("  Dra. Ana  Silva "), "DRA. ANA SILVA");
  assert.equal(councilType("crm-mg 123"), "CRM-MG");
  assert.equal(digitsOnly("(31) 99999-1234", 11), "31999991234");
  assert.equal(digitsOnly("CR 12.345/6", 12), "123456");
  assert.equal(validPhone("31999991234"), true);
  assert.equal(validPhone("1234"), false);
});

test("normalizes Brazilian clinic WhatsApp recipients to country-code format", () => {
  assert.equal(normalizeWhatsAppPhone("(31) 99999-9999"), "5531999999999");
  assert.equal(normalizeWhatsAppPhone("+55 31 99999-9999"), "5531999999999");
  assert.equal(validWhatsAppPhone("(31) 99999-9999"), true);
  assert.equal(validWhatsAppPhone("123"), false);
});
