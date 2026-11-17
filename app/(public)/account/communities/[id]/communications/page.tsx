import { sendCommunityAnnouncement } from "@/app/community-tools-actions";
import { getCurrentUser } from "@/lib/auth";
import { canManageCommunity } from "@/lib/community-host";
import { getCommunityById } from "@/lib/communities";
import { platformFeatures } from "@/lib/platform-features";
import { isStaff } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export default async function CommunityCommunicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/communities/${id}/communications`);
  const community = await getCommunityById(id);
  if (!community || !(await canManageCommunity(user.id, id, isStaff(user.role)))) notFound();
  const service = createServiceClient();
  const [{ count: eligible }, { data: announcements }, { data: settings }] = service
    ? await Promise.all([
        service
          .from("community_follows")
          .select("user_id", { count: "exact", head: true })
          .eq("community_id", id)
          .is("muted_at", null)
          .or("email_enabled.eq.true,push_enabled.eq.true"),
        service
          .from("community_announcements")
          .select("id, title, status, eligible_count, created_at, sent_at")
          .eq("community_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        service.from("community_announcement_settings").select("weekly_general_limit").eq("id", 1).maybeSingle(),
      ])
    : [{ count: 0 }, { data: [] }, { data: null }];
  const ids = (announcements ?? []).map((row) => row.id);
  const { data: jobs } = service && ids.length
    ? await service.from("notification_jobs").select("id, announcement_id, status").in("announcement_id", ids)
    : { data: [] };
  const jobIds = (jobs ?? []).map((row) => row.id);
  const { data: deliveries } = service && jobIds.length
    ? await service.from("notification_deliveries").select("job_id, status").in("job_id", jobIds)
    : { data: [] };
  const statusFor = (announcementId: string) => {
    const related = (jobs ?? []).filter((row) => row.announcement_id === announcementId);
    const relatedIds = new Set(related.map((row) => row.id));
    return {
      sent: related.filter((row) => row.status === "sent").length,
      failed: related.filter((row) => row.status === "failed").length,
      opened: new Set((deliveries ?? []).filter((row) => relatedIds.has(row.job_id) && row.status === "opened").map((row) => row.job_id)).size,
    };
  };
  const { error, sent } = await searchParams;

  return (
    <main>
      <p className="eyebrow">Community Announcements</p>
      <h1>{community.title}</h1>
      <p className="lede muted">
        Reach followers inside Venturo without seeing or exporting contact details.
        The current general-announcement limit is {settings?.weekly_general_limit ?? 2} per rolling week.
      </p>
      <p><a href={`/account/communities/${id}`}>Back to community manager</a></p>
      {error ? <p className="error">{error}</p> : null}
      {sent ? <p className="notice">Announcement queued. Delivery results will update below.</p> : null}
      {!platformFeatures.communityTools ? <p className="notice">Community messaging is staged off until its migration and delivery worker are enabled.</p> : null}
      <article className="cr-paper" style={{ padding: 24 }}>
        <p className="eyebrow">New Announcement</p>
        <h2>Preview &amp; send</h2>
        <p className="muted">Up to {eligible ?? 0} eligible followers before individual email, push and duplicate-reminder preferences are applied.</p>
        <form action={sendCommunityAnnouncement}>
          <input type="hidden" name="community_id" value={id} />
          <label className="field"><span>Title</span><input name="title" maxLength={80} required /></label>
          <label className="field"><span>Message</span><textarea name="body" maxLength={500} rows={5} required /></label>
          <label className="field"><span>Venturo destination</span><input name="destination_path" required placeholder={`/communities/${community.slug}`} /></label>
          <p className="muted">General announcements are rate-limited. Essential updates for registered event attendees use the separate event notification workflow.</p>
          <button className="btn btn-primary" type="submit" disabled={!platformFeatures.communityTools}>Queue Announcement</button>
        </form>
      </article>
      <section style={{ marginTop: 28 }}>
        <p className="eyebrow">Delivery</p>
        <h2>Recent announcements</h2>
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead><tr><th>Announcement</th><th>Audience</th><th>Delivered</th><th>Failed</th><th>Opened</th><th>Status</th></tr></thead>
            <tbody>
              {(announcements ?? []).map((announcement) => {
                const result = statusFor(announcement.id);
                return <tr key={announcement.id}>
                  <td>{announcement.title}<span className="muted"> · {new Date(announcement.created_at).toLocaleDateString("en-ZA")}</span></td>
                  <td>{announcement.eligible_count}</td><td>{result.sent}</td><td>{result.failed}</td><td>{result.opened}</td><td>{announcement.status}</td>
                </tr>;
              })}
              {!announcements?.length ? <tr><td colSpan={6} className="muted">No announcements yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
