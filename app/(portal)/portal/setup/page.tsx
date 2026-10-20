import { HostDetailsForm } from "@/components/portal/HostDetailsForm";
import { HostPayoutForm } from "@/components/portal/HostPayoutForm";
import { getCurrentUser } from "@/lib/auth";
import { defaultOrganiserProfile, loadOrganiserProfile } from "@/lib/host-profile";
import { loadMemberProfile } from "@/lib/profile";
import {
  PORTAL_EVENTS_NEW,
  PORTAL_LOGIN,
  portalLoginHref,
  portalSetupHref,
} from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(portalLoginHref(true, portalSetupHref("details")));

  const { step: stepRaw } = await searchParams;
  const profile = await loadMemberProfile(user.id);
  const firstName = profile.firstName || (user.firstName !== "there" ? user.firstName : "");
  const lastName = profile.lastName;
  const email = user.email ?? "";
  const savedHost = await loadOrganiserProfile(user.id);
  const hostProfile = defaultOrganiserProfile(firstName, lastName, email, savedHost);
  const hasHost = Boolean(savedHost?.hostName.trim());

  const supabase = await createClient();
  let existingPayout: {
    accountHolder: string;
    bankName: string;
    accountNumberLast4: string;
    branchCode: string | null;
  } | null = null;

  if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("account_holder, bank_name, account_number_last4, branch_code")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      existingPayout = {
        accountHolder: data.account_holder,
        bankName: data.bank_name,
        accountNumberLast4: data.account_number_last4,
        branchCode: data.branch_code,
      };
    }
  }

  const hasBank = Boolean(existingPayout);
  if (!stepRaw && hasHost && hasBank) redirect(PORTAL_EVENTS_NEW);
  if (stepRaw === "bank" && !hasHost) redirect(portalSetupHref("details"));
  if (!stepRaw && hasHost && !hasBank) redirect(portalSetupHref("bank"));

  const step = stepRaw === "bank" ? "bank" : "details";

  return (
    <main className="portal-studio">
      <div className="studio-shell host-settings">
        <p className="eyebrow">Event Host</p>
        <h1>{step === "bank" ? "Host Bank" : "Host Details"}</h1>
        <p className="lede muted">
          {step === "bank"
            ? "One account for every paid event. We pay this bank when tickets sell."
            : "This is the host people see on your events. Bank comes next."}
        </p>
        <div className="chips host-settings-tabs" role="tablist" aria-label="Host setup">
          <a
            className={`chip${step === "details" ? " on" : ""}`}
            href={portalSetupHref("details")}
            aria-current={step === "details" ? "step" : undefined}
          >
            1 · Host Details
          </a>
          {hasHost ? (
            <a
              className={`chip${step === "bank" ? " on" : ""}`}
              href={portalSetupHref("bank")}
              aria-current={step === "bank" ? "step" : undefined}
            >
              2 · Host Bank
            </a>
          ) : (
            <span className="chip" aria-disabled="true">
              2 · Host Bank
            </span>
          )}
        </div>
        {step === "bank" ? (
          <HostPayoutForm
            existingPayout={existingPayout}
            fallbackHolder={firstName}
            afterSaveHref={PORTAL_EVENTS_NEW}
            submitLabel="Continue"
          />
        ) : (
          <HostDetailsForm
            firstName={firstName}
            lastName={lastName}
            email={email}
            hostProfile={hostProfile}
            afterSaveHref={portalSetupHref("bank")}
            submitLabel="Continue"
          />
        )}
      </div>
    </main>
  );
}
