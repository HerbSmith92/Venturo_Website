import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { deleteNotice, openNotice, saveNotificationPreferences } from "./actions";

type Notice = {
  id: string;
  title: string | null;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string | null;
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/notifications");
  const supabase = await createClient();
  const [{ data }, { data: preferences }] = supabase
    ? await Promise.all([
        supabase
          .from("push_inbox")
          .select("id, title, body, link_path, read_at, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("notification_preferences")
          .select("channel, enabled")
          .eq("topic", "event_reminder")
          .eq("scope_type", "global"),
      ])
    : [{ data: [] }, { data: [] }];
  const notices = (data ?? []) as Notice[];
  const reminderEmail = preferences?.find((row) => row.channel === "email")?.enabled ?? true;
  const reminderPush = preferences?.find((row) => row.channel === "push")?.enabled ?? true;

  return (
    <>
      <p className="eyebrow">My Venturo</p>
      <h1>Notifications</h1>
      <p className="lede muted">The same inbox as the app. Open one, or remove it.</p>
      <form action={saveNotificationPreferences} className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h2>Event reminders</h2>
          <p className="muted">Choose how Venturo reminds you 24 hours &amp; 2 hours before an event.</p>
          <label className="check-row">
            <input type="checkbox" name="email" defaultChecked={reminderEmail} />
            <span>Email</span>
          </label>
          <label className="check-row">
            <input type="checkbox" name="push" defaultChecked={reminderPush} />
            <span>Push notification</span>
          </label>
          <button className="btn btn-primary" type="submit">Save preferences</button>
        </div>
      </form>
      {notices.length === 0 ? (
        <p className="muted">All quiet. When a plan, a place, or a ping is worth your time, it shows up here.</p>
      ) : (
        <div className="grid">
          {notices.map((notice) => {
            const path = notice.link_path?.trim() ?? "";
            const href = path.startsWith("http") ? path : path.startsWith("/") ? path : "";
            return (
              <article key={notice.id} className="card">
                <div className="card-body">
                  <h3>{notice.title?.trim() || "Venturo"}</h3>
                  {notice.body ? <p className="card-meta">{notice.body}</p> : null}
                  {href ? (
                    <form action={openNotice.bind(null, notice.id, href)}>
                      <button className="linkish" type="submit">Open</button>
                    </form>
                  ) : null}
                  <form action={deleteNotice.bind(null, notice.id)}>
                    <button type="submit" className="btn btn-secondary">
                      Remove
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
