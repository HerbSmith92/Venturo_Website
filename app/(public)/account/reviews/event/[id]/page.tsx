import { saveEventReview } from "@/app/event-followup-actions";
import { getCurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { buyerHasTicket, loadMyEventReview } from "@/lib/event-followups";
import { notFound, redirect } from "next/navigation";

export default async function EventReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/account/reviews/event/${id}`);
  const event = await getEventById(id);
  if (!event) notFound();
  const allowed = await buyerHasTicket(id, user.id);
  const existing = await loadMyEventReview(id, user.id);
  const ended = event.endsAt ? new Date(event.endsAt).getTime() < Date.now() : false;

  return (
    <>
      <p className="eyebrow">Reviews</p>
      <h1>How was {event.title}?</h1>
      <p className="lede muted">A short note from someone who had a ticket helps other locals decide.</p>
      {query.error ? <p className="error">{query.error}</p> : null}
      {query.saved ? <p className="notice">Review saved. Thank you.</p> : null}
      {!allowed ? (
        <p className="muted">This review is for people who bought or were given a ticket.</p>
      ) : !ended ? (
        <p className="muted">Reviews open once the event has ended.</p>
      ) : (
        <form className="studio-card" action={saveEventReview}>
          <input type="hidden" name="eventId" value={id} />
          <label className="field">
            <span>Rating</span>
            <select name="rating" required defaultValue={existing?.rating ? String(existing.rating) : ""}>
              <option value="" disabled>
                Pick 1 to 5
              </option>
              <option value="5">5 · Loved it</option>
              <option value="4">4 · Good night</option>
              <option value="3">3 · Fine</option>
              <option value="2">2 · Rough</option>
              <option value="1">1 · Miss</option>
            </select>
          </label>
          <label className="field">
            <span>What was it like?</span>
            <textarea name="body" rows={5} maxLength={2000} required defaultValue={existing?.body ?? ""} />
          </label>
          <button className="btn btn-primary" type="submit">
            {existing ? "Update review" : "Send review"}
          </button>
        </form>
      )}
      <p>
        <a href="/account/reviews">All my reviews</a>
      </p>
    </>
  );
}
