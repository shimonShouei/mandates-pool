import { createHash, randomBytes } from "node:crypto";

export function newId(): string {
  return randomBytes(12).toString("base64url");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return code;
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nameKey(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function cleanDisplayName(input: string): string | null {
  const name = input.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 24) return null;
  if (/[\u0000-\u001f]/.test(name)) return null;
  return name;
}
