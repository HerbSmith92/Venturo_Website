import { johannesburgDateKey } from "@/lib/overview/metrics";
import { createServiceClient } from "@/lib/supabase/admin";

export type ActivityPlatform = "web" | "ios" | "android" | "unknown";

/** Records one signed-in activity. Failures stay off the member's path. */
export async function recordMemberActivity(
  userId: string,
  kind: string,
  platform: ActivityPlatform = "web",
) {
  if (!userId || !kind) return;
  const service = createServiceClient();
  if (!service) return;
  const { error } = await service.from("member_activity").upsert(
    {
      user_id: userId,
      day: johannesburgDateKey(new Date()),
      platform,
      kind,
    },
    { onConflict: "user_id,day,platform,kind", ignoreDuplicates: true },
  );
  if (error && !/member_activity/i.test(error.message)) {
    console.error("recordMemberActivity", error.message);
  }
}
