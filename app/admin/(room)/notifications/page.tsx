import { PushComposer } from "@/components/admin/PushComposer";
import { formatClock } from "@/lib/control-room";
import { loadPushDesk, pushAppLabel, pushAudienceLabel } from "@/lib/push-notifications";

export default async function PushNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const desk = await loadPushDesk();
  const missingTable = Boolean(desk.loadError && /push_(campaigns|devices|inbox)|schema cache/i.test(desk.loadError));

  return (
    <section>
      <p className="eyebrow">Application</p>
      <h1>Push Notifications</h1>
      <p className="lede muted">
        Write a message for the Companion app or the member app. Phones that allowed notifications
        get it on the lock screen. Everyone matched also keeps it in the app.
      </p>

      {params.error ? <p className="error">{params.error}</p> : null}
      {!desk.serviceRoleReady && (
        <p className="notice">
          Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to <code>.env.local</code> before this desk can
          read phones or send.
        </p>
      )}
      {missingTable && (
        <p className="notice">
          Apply <code>supabase/migrations/20261013103334_push_notifications.sql</code> so this desk
          can store campaigns & phone registrations.
        </p>
      )}
      {desk.loadError && !missingTable ? <p className="error">{desk.loadError}</p> : null}

      <div className="cr-stats" style={{ marginBottom: 24 }}>
        <article className="cr-stat">
          <span className="muted">Companion phones</span>
          <strong>{desk.stats.companion}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">Companion push ready</span>
          <strong>{desk.stats.companionPush}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">Member phones</span>
          <strong>{desk.stats.member}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">Member push ready</span>
          <strong>{desk.stats.memberPush}</strong>
        </article>
      </div>

      <p className="muted" style={{ marginTop: -8, marginBottom: 24 }}>
        Push ready means the phone allowed notifications. Every matched phone still keeps the message in the app.
      </p>

      <PushComposer disabled={!desk.serviceRoleReady || missingTable} />

      <h2>Sent</h2>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Message</th>
              <th>App</th>
              <th>Who</th>
              <th>In the app</th>
              <th>Pushed</th>
            </tr>
          </thead>
          <tbody>
            {desk.campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nothing sent yet.
                </td>
              </tr>
            )}
            {desk.campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>{formatClock(campaign.created_at)}</td>
                <td>
                  <strong>{campaign.title}</strong>
                  <div className="muted">{campaign.body}</div>
                  {campaign.link_path ? <div className="muted">{campaign.link_path}</div> : null}
                  {campaign.status === "failed" && campaign.error ? (
                    <div className="error">{campaign.error}</div>
                  ) : null}
                </td>
                <td>{pushAppLabel(campaign.app)}</td>
                <td>{pushAudienceLabel(campaign.audience)}</td>
                <td>{campaign.inbox_count}</td>
                <td>
                  {campaign.pushed_count}
                  {campaign.failed_count > 0 ? (
                    <span className="muted"> · {campaign.failed_count} failed</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
