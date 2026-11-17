"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function deleteNotice(id: string) {
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.rpc("delete_push_inbox", { p_inbox_id: id });
  revalidatePath("/account/notifications");
}

export async function openNotice(id: string, path: string) {
  const supabase = await createClient();
  if (supabase) await supabase.rpc("mark_push_read", { p_inbox_id: id });
  redirect(path.startsWith("/") ? path : "/account/notifications");
}

export async function saveNotificationPreferences(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/notifications");
  const supabase = await createClient();
  if (!supabase) return;
  await supabase
    .from("notification_preferences")
    .delete()
    .eq("user_id", user.id)
    .eq("topic", "event_reminder")
    .eq("scope_type", "global");
  await supabase.from("notification_preferences").insert(
    (["email", "push"] as const).map((channel) => ({
      user_id: user.id,
      topic: "event_reminder",
      channel,
      scope_type: "global",
      scope_id: null,
      enabled: formData.get(channel) === "on",
    })),
  );
  revalidatePath("/account/notifications");
}
