import { redirect } from "next/navigation";
import { PolicyConsentForm } from "@/components/PolicyConsentForm";
import { getCurrentUser } from "@/lib/auth";
import { hasMemberConsent } from "@/lib/policy-consent";
import { safeNextPath } from "@/lib/member-auth";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  const next = safeNextPath((await searchParams).next);
  if (!user) redirect(`/login?next=${encodeURIComponent("/account/consent")}`);
  if (await hasMemberConsent(user.id)) redirect(next);

  return (
    <>
      <p className="eyebrow">Before You Continue</p>
      <h1>Policies</h1>
      <p className="lede muted">
        Accept the Terms &amp; Conditions &amp; acknowledge the Privacy Policy to finish creating your account.
      </p>
      <PolicyConsentForm next={next} />
    </>
  );
}
