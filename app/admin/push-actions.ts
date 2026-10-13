"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { deliverPushCampaign, parsePushDraft, type PushSendResult } from "@/lib/push-notifications";

export type PushSendState = PushSendResult;

export async function sendPushCampaign(_previous: PushSendState | null, formData: FormData): Promise<PushSendState> {
  const session = await requireStaff();
  const parsed = parsePushDraft({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    audience: String(formData.get("audience") ?? ""),
    opens: String(formData.get("opens") ?? ""),
    place: String(formData.get("place") ?? ""),
  });

  if ("error" in parsed) return parsed;

  const result = await deliverPushCampaign(parsed.draft, session.id);
  revalidatePath("/admin/notifications");
  return result;
}
