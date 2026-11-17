import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

const RECENT_AUTH_SECONDS = 10 * 60;

function encryptionKey() {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("PAYOUT_ENCRYPTION_KEY is not configured.");

  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PAYOUT_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.");
  }
  return key;
}

/** Encrypts bank account data with AES-256-GCM. The returned value is safe to store, not to log. */
export function encryptPayoutAccount(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptPayoutAccount(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported payout account encryption.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Payout changes require a freshly verified Supabase session, not only a client-side OTP screen. */
export async function hasRecentPayoutAuthentication(now = Math.floor(Date.now() / 1000)) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getClaims();
  if (error) return false;
  const authTime = Number(data?.claims?.auth_time);
  return Number.isFinite(authTime) && now - authTime >= 0 && now - authTime <= RECENT_AUTH_SECONDS;
}
