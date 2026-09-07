import type { TicketKind } from "@/lib/event-types";
import { digitsOnly, isAllowedBankName } from "@/lib/sa-banks";
import { createClient } from "@/lib/supabase/server";

export type PayoutInput = {
  accountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  accountNumberConfirm?: string;
  branchCode?: string;
  confirmed?: boolean;
};

export async function savePayoutProfile(userId: string, firstName: string, payout: PayoutInput) {
  if (!payout.confirmed) {
    throw new Error("Tick the box to confirm these details are correct.");
  }

  const bankName = (payout.bankName ?? "").trim();
  const account = digitsOnly(payout.accountNumber ?? "");
  const confirm = digitsOnly(payout.accountNumberConfirm ?? "");
  const holder = (payout.accountHolder ?? "").trim() || firstName;
  if (!isAllowedBankName(bankName)) throw new Error("Pick a bank.");
  if (!holder) throw new Error("Add the account holder.");
  if (!account) throw new Error("Add the account number.");
  if (account.length < 7 || account.length > 16) {
    throw new Error("Account number should be 7 to 16 digits.");
  }
  if (account !== confirm) throw new Error("Account numbers do not match.");

  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const last4 = account.slice(-4);
  const { error } = await supabase.from("organiser_payout_profiles").upsert({
    user_id: userId,
    account_holder: holder,
    bank_name: bankName,
    account_number_last4: last4 || "0000",
    account_number_enc: Buffer.from(account).toString("base64"),
    branch_code: payout.branchCode?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function requirePaidPayout(
  userId: string,
  tickets: { kind?: TicketKind; priceCents?: number }[],
) {
  const hasPaid = tickets.some(
    (ticket) => (ticket.kind as TicketKind) === "paid" && (ticket.priceCents ?? 0) > 0,
  );
  if (!hasPaid) return;

  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");
  const { data } = await supabase
    .from("organiser_payout_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    throw new Error(
      "Add a payout bank in Host Settings before going live with paid tickets.",
    );
  }
}
