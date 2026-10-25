import { createServiceClient } from "@/lib/supabase/admin";

/** Effective date on the published Terms & Privacy Policy. */
export const TERMS_VERSION = "2025-10-01";
export const PRIVACY_VERSION = "2025-10-01";
export const CONSENT_COOKIE = "venturo_policy_consent";

export const CONSENT_REQUIRED =
  "Accept the Terms & Conditions & acknowledge the Privacy Policy.";

export function consentCookieValue() {
  return `${TERMS_VERSION}|${PRIVACY_VERSION}`;
}

export function formHasConsent(form: FormData) {
  return form.get("acceptTerms") === "on" && form.get("acceptPrivacy") === "on";
}

export function bodyHasConsent(body: { acceptTerms?: boolean; acceptPrivacy?: boolean }) {
  return body.acceptTerms === true && body.acceptPrivacy === true;
}

export async function hasMemberConsent(userId: string) {
  const service = createServiceClient();
  if (!service) return false;
  const { data, error } = await service
    .from("member_consents")
    .select("policy, version")
    .eq("user_id", userId)
    .in("policy", ["terms", "privacy"]);
  if (error || !data) return false;
  const terms = data.some((row) => row.policy === "terms" && row.version === TERMS_VERSION);
  const privacy = data.some((row) => row.policy === "privacy" && row.version === PRIVACY_VERSION);
  return terms && privacy;
}

export async function recordMemberConsent(userId: string, source: string) {
  const service = createServiceClient();
  if (!service) return;
  const acceptedAt = new Date().toISOString();
  const { error } = await service.from("member_consents").upsert(
    [
      {
        user_id: userId,
        policy: "terms",
        version: TERMS_VERSION,
        source,
        accepted_at: acceptedAt,
      },
      {
        user_id: userId,
        policy: "privacy",
        version: PRIVACY_VERSION,
        source,
        accepted_at: acceptedAt,
      },
    ],
    { onConflict: "user_id,policy,version", ignoreDuplicates: true },
  );
  if (error) console.error("member consent", error.message);
}
