"use client";

import { HostDetailsForm } from "@/components/portal/HostDetailsForm";
import { HostPayoutForm } from "@/components/portal/HostPayoutForm";
import type { OrganiserProfile } from "@/lib/host-profile-shared";
import { PORTAL_SETTINGS, PORTAL_SETTINGS_BANK } from "@/lib/portal";

export type HostSettingsTab = "details" | "bank";

type ExistingPayout = {
  accountHolder: string;
  bankName: string;
  accountNumberLast4: string;
  branchCode: string | null;
} | null;

export function HostSettings({
  tab,
  firstName,
  lastName,
  email,
  hostProfile,
  existingPayout,
}: {
  tab: HostSettingsTab;
  firstName: string;
  lastName: string;
  email: string;
  hostProfile: OrganiserProfile;
  existingPayout: ExistingPayout;
}) {
  return (
    <div className="studio-shell host-settings">
      <p className="eyebrow">Host Settings</p>
      <h1>{tab === "bank" ? "Payout Bank" : "Host Details"}</h1>
      <p className="lede muted">
        {tab === "bank"
          ? "One account for every paid event. We pay this bank when tickets sell—not a different account per listing."
          : "This is the host people see on your events. Payout bank lives on its own tab."}
      </p>
      <div className="chips host-settings-tabs" role="tablist" aria-label="Host Settings">
        <a
          className={`chip${tab === "details" ? " on" : ""}`}
          href={PORTAL_SETTINGS}
          role="tab"
          aria-selected={tab === "details"}
        >
          Host Details
        </a>
        <a
          className={`chip${tab === "bank" ? " on" : ""}`}
          href={PORTAL_SETTINGS_BANK}
          role="tab"
          aria-selected={tab === "bank"}
        >
          Payout Bank
        </a>
      </div>
      {tab === "bank" ? (
        <HostPayoutForm existingPayout={existingPayout} fallbackHolder={firstName} />
      ) : (
        <HostDetailsForm
          firstName={firstName}
          lastName={lastName}
          email={email}
          hostProfile={hostProfile}
        />
      )}
    </div>
  );
}
