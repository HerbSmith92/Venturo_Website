"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function bounded(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export async function saveOverviewThresholds(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) redirect("/admin?error=Supabase+is+not+connected.");
  const { error } = await supabase
    .from("ops_dashboard_settings")
    .update({
      overdue_hours: bounded(formData.get("overdue_hours"), 48, 1, 24 * 30),
      low_sales_percent: bounded(formData.get("low_sales_percent"), 25, 0, 100),
      low_sales_within_days: bounded(formData.get("low_sales_within_days"), 3, 1, 30),
      membership_ending_days: bounded(formData.get("membership_ending_days"), 7, 1, 90),
      payout_due_days: bounded(formData.get("payout_due_days"), 7, 0, 90),
      listing_check_days: bounded(formData.get("listing_check_days"), 180, 7, 3650),
      ticket_email_grace_minutes: bounded(formData.get("ticket_email_grace_minutes"), 30, 5, 24 * 60),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  redirect("/admin?saved=thresholds");
}

export async function resolveEnquiry(formData: FormData) {
  const session = await requireStaff();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!supabase || !id) redirect("/admin/enquiries");
  const { error } = await supabase
    .from("enquiries")
    .update({ resolved_at: new Date().toISOString(), resolved_by: session.id })
    .eq("id", id)
    .is("resolved_at", null);
  if (error) redirect(`/admin/enquiries?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/admin/enquiries");
  redirect("/admin/enquiries?done=resolved");
}
