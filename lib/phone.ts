/** Keep a typed SA-style number. Reject anything that is not a real cellphone length. */
export function tidyCellphone(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 20);
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return trimmed;
}
