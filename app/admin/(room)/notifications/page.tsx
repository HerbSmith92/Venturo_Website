import { PushComposer } from "@/components/admin/PushComposer";
import { formatClock } from "@/lib/control-room";
import { loadPushDesk, loadPushOptions, pushAudienceLabel, pushNoticeLabel } from "@/lib/push-notifications";

export default async function PushNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const [desk, options] = await Promise.all([loadPushDesk(), loadPushOptions()]);
  const missingTable = Boolean(desk.loadError && /push_(campaigns|devices|inbox)|schema cache/i.test(desk.loadError));

  return (
    <section>
      <p className="eyebrow">Application</p>
      <h1>Push Notifications</h1>
      <p className="lede muted">
        Write a message for the Venturo Application. Remind people to open the app, tell a community about a new event, or point someone at an interest, the weekend, or their favourites.
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
          <span className="muted">Phones</span>
          <strong>{desk.stats.phones}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">Push ready</span>
          <strong>{desk.stats.pushReady}</strong>
        </article>
      </div>

      <p className="muted" style={{ marginTop: -8, marginBottom: 24 }}>
        Push ready means the phone allowed notifications. Every matched phone still keeps the message in the app.
      </p>

      <PushComposer
        disabled={!desk.serviceRoleReady || missingTable}
        guides={options.guides}
        events={options.events}
        places={options.places}
        communities={options.communities}
        interests={options.interests}
      />

      <h2>Opened</h2>
      <p className="muted">
        Each person is counted once, when they tap the notification or open it in the Venturo Application.
      </p>
      <div className="cr-stats" style={{ marginTop: 16, marginBottom: 28 }}>
        <article className="cr-stat">
          <span className="muted">People opened</span>
          <strong>{desk.stats.opened}</strong>
        </article>
        <article className="cr-stat">
          <span className="muted">People reached</span>
          <strong>{desk.stats.reached}</strong>
        </article>
      </div>

      <h2>Sent</h2>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Message</th>
              <th>Goes to</th>
              <th>Where</th>
              <th>Who</th>
              <th>Pushed</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {desk.campaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Nothing sent yet.
                </td>
              </tr>
            )}
            {desk.campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>{formatClock(campaign.created_at)}</td>
                <td>
                  <strong>{campaign.title}</strong>
                  <div className="muted">{pushNoticeLabel(campaign.notice_kind)}</div>
                  <div className="muted">{campaign.body}</div>
                  {campaign.status === "failed" && campaign.error ? (
                    <div className="error">{campaign.error}</div>
                  ) : null}
                </td>
                <td>
                  {campaign.opens_label ?? "Notification list"}
                  {campaign.link_path ? <div className="muted">{campaign.link_path}</div> : null}
                </td>
                <td>{campaign.place_label ?? "Everywhere"}</td>
                <td>{pushAudienceLabel(campaign.audience)}</td>
                <td>
                  {campaign.pushed_count}
                  {campaign.failed_count > 0 ? (
                    <span className="muted"> · {campaign.failed_count} failed</span>
                  ) : null}
                </td>
                <td>
                  {campaign.opened_count}
                  {campaign.inbox_count > 0 ? (
                    <span className="muted">
                      {" "}
                      · {Math.round((campaign.opened_count / campaign.inbox_count) * 100)}%
                    </span>
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
