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
