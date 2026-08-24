export function digitsOnly(value, maxLength = Infinity) {
  return String(value ?? "").replace(/\D/g, "").slice(0, maxLength);
}

export function uppercaseText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function councilType(value) {
  return uppercaseText(value).replace(/[^A-Z-]/g, "").slice(0, 12);
}

export function validPhone(value) {
  return /^\d{10,11}$/.test(value);
}

export function normalizeWhatsAppPhone(value) {
  const digits = digitsOnly(value, 15);
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return digits;
}

export function validWhatsAppPhone(value) {
  return /^\d{12,15}$/.test(normalizeWhatsAppPhone(value));
}
