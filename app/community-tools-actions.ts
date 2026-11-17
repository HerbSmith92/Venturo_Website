"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { canManageCommunity } from "@/lib/community-host";
import { platformFeatures } from "@/lib/platform-features";
import { isStaff } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateCommunityFollowPreferences(formData: FormData) {
  const user = await getCurrentUser();
  const communityId = String(formData.get("community_id") ?? "");
  if (!user || !UUID.test(communityId)) redirect("/account/communities");
  const supabase = await createClient();
  if (!supabase) redirect("/account/communities?error=Preferences+are+unavailable.");
  await supabase
    .from("community_follows")
    .update({
      host_visible: formData.get("host_visible") === "on",
      email_enabled: formData.get("email_enabled") === "on",
      push_enabled: formData.get("push_enabled") === "on",
      muted_at: formData.get("muted") === "on" ? new Date().toISOString() : null,
    })
    .eq("community_id", communityId)
    .eq("user_id", user.id);
  revalidatePath("/account/communities");
  redirect("/account/communities?preferences=saved");
}

export async function reportCommunityMessages(formData: FormData) {
  const user = await getCurrentUser();
  const communityId = String(formData.get("community_id") ?? "");
  const announcementId = String(formData.get("announcement_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!user || !UUID.test(communityId) || !reason) redirect("/account/communities");
  const supabase = await createClient();
  await supabase?.from("community_reports").insert({
    community_id: communityId,
    reporter_id: user.id,
    announcement_id: UUID.test(announcementId) ? announcementId : null,
    reason,
  });
  redirect("/account/communities?reported=1");
}

function preferenceEnabled(
  rows: Array<{ user_id: string; channel: string; scope_type: string; scope_id: string | null; enabled: boolean }>,
  userId: string,
  channel: "email" | "push",
  communityId: string,
) {
  const relevant = rows.filter((row) => row.user_id === userId && row.channel === channel);
  const scoped = relevant.find((row) => row.scope_type === "community" && row.scope_id === communityId);
  if (scoped) return scoped.enabled;
  return relevant.find((row) => row.scope_type === "global")?.enabled ?? true;
}

export async function sendCommunityAnnouncement(formData: FormData) {
  const user = await getCurrentUser();
  const communityId = String(formData.get("community_id") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const body = String(formData.get("body") ?? "").trim().slice(0, 500);
  const destinationPath = String(formData.get("destination_path") ?? "").trim();
  const back = `/account/communities/${communityId}/communications`;
  if (!user || !UUID.test(communityId)) redirect("/account/communities");
  if (!platformFeatures.communityTools) redirect(`${back}?error=Community+tools+are+not+enabled.`);
  if (!title || !body || !/^\/(?!\/)[A-Za-z0-9/?#&=._%-]{1,500}$/.test(destinationPath)) {
    redirect(`${back}?error=Add+a+title,+message+and+valid+Venturo+destination.`);
  }
  if (!(await canManageCommunity(user.id, communityId, isStaff(user.role)))) redirect("/account/communities");
  const service = createServiceClient();
  if (!service) redirect(`${back}?error=Messaging+is+unavailable.`);

  const [{ data: settings }, { count: sentThisWeek }] = await Promise.all([
    service.from("community_announcement_settings").select("weekly_general_limit").eq("id", 1).maybeSingle(),
    service
      .from("community_announcements")
      .select("id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("category", "general")
      .in("status", ["scheduled", "sending", "sent"])
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);
  const limit = Number(settings?.weekly_general_limit) || 2;
  if ((sentThisWeek ?? 0) >= limit) {
    redirect(`${back}?error=${encodeURIComponent(`This community has reached its ${limit}-announcement weekly limit.`)}`);
  }

  const { data: follows } = await service
    .from("community_follows")
    .select("user_id, email_enabled, push_enabled, muted_at")
    .eq("community_id", communityId)
    .is("muted_at", null);
  const users = (follows ?? []).map((row) => String(row.user_id));
  const { data: preferences } = users.length
    ? await service
        .from("notification_preferences")
        .select("user_id, channel, scope_type, scope_id, enabled")
        .eq("topic", "community_announcement")
        .in("user_id", users)
    : { data: [] };
  const eventSlug = destinationPath.match(/^\/events\/([^/?#]+)/)?.[1];
  const { data: destinationEvent } = eventSlug
    ? await service.from("events").select("id").eq("slug", eventSlug).maybeSingle()
    : { data: null };
  const { data: overlappingReminders } = destinationEvent && users.length
    ? await service
        .from("notification_jobs")
        .select("user_id, channel")
        .eq("event_id", destinationEvent.id)
        .in("user_id", users)
        .in("status", ["queued", "processing", "sent", "failed"])
        .gte("scheduled_for", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte("scheduled_for", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
    : { data: [] };
  const duplicateChannels = new Set(
    (overlappingReminders ?? []).map((row) => `${row.user_id}:${row.channel}`),
  );
  const eligible = new Set<string>();
  const jobs: Array<Record<string, unknown>> = [];
  const announcementId = crypto.randomUUID();
  const now = new Date().toISOString();
  for (const follow of follows ?? []) {
    const userId = String(follow.user_id);
    for (const channel of ["email", "push"] as const) {
      const followEnabled = channel === "email" ? follow.email_enabled : follow.push_enabled;
      if (
        !followEnabled ||
        !preferenceEnabled(preferences ?? [], userId, channel, communityId) ||
        duplicateChannels.has(`${userId}:${channel}`)
      ) continue;
      eligible.add(userId);
      jobs.push({
        purpose: "community_announcement",
        announcement_id: announcementId,
        community_id: communityId,
        user_id: userId,
        channel,
        scheduled_for: now,
        idempotency_key: `community:${announcementId}:${userId}:${channel}`,
        payload: {
          kind: "community",
          title,
          body,
          linkPath: destinationPath,
          communityId,
          announcementId,
        },
      });
    }
  }
  const { error: announcementError } = await service.from("community_announcements").insert({
    id: announcementId,
    community_id: communityId,
    author_id: user.id,
    title,
    body,
    destination_path: destinationPath,
    category: "general",
    status: jobs.length ? "sending" : "sent",
    eligible_count: eligible.size,
    scheduled_for: now,
    sent_at: jobs.length ? null : now,
  });
  if (announcementError) redirect(`${back}?error=${encodeURIComponent(announcementError.message)}`);
  if (jobs.length) {
    const { error } = await service.from("notification_jobs").insert(jobs);
    if (error) {
      await service.from("community_announcements").update({ status: "cancelled" }).eq("id", announcementId);
      redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    }
  }
  revalidatePath(back);
  redirect(`${back}?sent=1`);
}

export async function reviewCommunityClaim(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = String(formData.get("request_id") ?? "");
  const decision = formData.get("decision") === "approve" ? "approved" : "rejected";
  const service = createServiceClient();
  if (!service || !UUID.test(requestId)) redirect("/admin/communities?error=Invalid+claim.");
  const { data: request } = await service
    .from("community_claim_requests")
    .select("community_id, requested_by, status, communities(claimed_by)")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.status !== "pending") redirect("/admin/communities?error=Claim+is+not+pending.");
  const community = Array.isArray(request.communities) ? request.communities[0] : request.communities;
  if (decision === "approved" && community?.claimed_by && community.claimed_by !== request.requested_by) {
    redirect("/admin/communities?error=That+community+already+has+an+owner.");
  }
  if (decision === "approved") {
    await service.from("community_managers").upsert({
      community_id: request.community_id,
      user_id: request.requested_by,
      role: "owner",
      status: "active",
      invited_by: admin.id,
    });
    await service.from("communities").update({ claimed_by: request.requested_by }).eq("id", request.community_id).is("claimed_by", null);
  }
  await service
    .from("community_claim_requests")
    .update({ status: decision, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);
  revalidatePath("/admin/communities");
  redirect("/admin/communities");
}
