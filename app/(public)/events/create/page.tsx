import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { PORTAL_EVENTS_NEW, portalLoginHref } from "@/lib/portal";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create An Event · Venturo",
  description: "Log in and start with the event. Bank details come after a paid ticket.",
};

export default async function CreateEventPage() {
  const user = await getCurrentUser();
  if (user) redirect(PORTAL_EVENTS_NEW);

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Event Host</p>
        <h1>Do You Have An Account?</h1>
        <p className="lede muted">
          Log in &amp; start with the event. Bank details come after a paid ticket.
        </p>
        <div className="grid" style={{ marginTop: 28 }}>
          <article className="plan">
            <h2>Yes</h2>
            <p className="muted">You already have a Venturo account. Log in &amp; start the event.</p>
            <a className="btn btn-primary" href={portalLoginHref(false, PORTAL_EVENTS_NEW)}>
              Log In
            </a>
          </article>
          <article className="plan">
            <h2>No</h2>
            <p className="muted">
              Create a host account, then start with the event details.
            </p>
            <a className="btn btn-secondary" href={portalLoginHref(true, PORTAL_EVENTS_NEW)}>
              Create A Host Account
            </a>
          </article>
        </div>
      </section>
    </main>
  );
}
