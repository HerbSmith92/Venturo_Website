import { submitClaim } from "@/app/member-actions";

export function ClaimRequestButton({
  listingId,
  listingName,
  listingSlug,
  signedIn,
}: {
  listingId: string;
  listingName: string;
  listingSlug: string;
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <a className="btn btn-primary" href={`/login?next=/directory/claim?q=${encodeURIComponent(listingName)}`}>
        Log In To Claim
      </a>
    );
  }

  return (
    <form action={submitClaim} className="field">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="listing_name" value={listingName} />
      <input type="hidden" name="listing_slug" value={listingSlug} />
      <span>Help us verify your connection</span>
      <p className="muted">
        Tell us your role at the business &amp; provide information that helps us confirm you&apos;re authorised to manage this listing, such as your business email address or a link to your official website.
      </p>
      <textarea
        name="evidence"
        required
        rows={4}
        placeholder="I’m the owner or manager of this business. My business email address is…"
      />
      <button className="btn btn-primary" type="submit">
        Submit claim request
      </button>
    </form>
  );
}
