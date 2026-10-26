import { FeeSettingsForm } from "@/components/admin/FeeSettingsForm";
import { getStaffSession } from "@/lib/auth";
import { getPlatformFees } from "@/lib/events";
import { isAdmin } from "@/lib/roles";

export default async function TicketFeesPage() {
  const session = await getStaffSession();
  const fees = await getPlatformFees();
  const canEdit = isAdmin(session?.role);

  return (
    <section className="cr-paper">
      <p className="eyebrow">Settings</p>
      <h1>Ticket fees</h1>
      <p className="muted fee-lede">
        Set the rates. The host chooses who pays the booking fee and the commission on each event.
      </p>
      {canEdit ? (
        <article className="plan" style={{ marginTop: 28 }}>
          <FeeSettingsForm fees={fees} />
        </article>
      ) : (
        <article className="plan" style={{ marginTop: 28 }}>
          <ul>
            <li>Commission: {fees.commissionPct}%</li>
            <li>Booking fee: R {(fees.bookingFeeCents / 100).toFixed(2)}</li>
            <li>Member discount: {fees.memberDiscountPct}%</li>
          </ul>
          <p className="muted fee-lede">Only an admin can change these rates.</p>
        </article>
      )}
    </section>
  );
}
